const { RouterOSAPI } = require('node-routeros');
const { Channel } = require('node-routeros/dist/Channel');
const { Receiver } = require('node-routeros/dist/connector/Receiver');
const { query } = require('../db/pool');

// Monkey-patch Channel to handle RouterOS v7 '!empty' reply without crashing
const originalOnUnknown = Channel.prototype.onUnknown;
Channel.prototype.onUnknown = function(reply) {
  if (reply === '!empty') {
    if (!this.trapped) {
        this.emit('done', this.data);
    }
    // processPacket will call this.close() automatically
  } else {
    originalOnUnknown.call(this, reply);
  }
};

// Monkey-patch Receiver to prevent UNREGISTEREDTAG crashes
// when Mikrotik sends '!done' AFTER we already closed the channel for '!empty'
const originalSendTagData = Receiver.prototype.sendTagData;
Receiver.prototype.sendTagData = function(currentTag) {
  const tag = this.tags.get(currentTag);
  if (tag) {
    originalSendTagData.call(this, currentTag);
  } else {
    console.warn(`[MikroTik] Ignored data on unregistered tag ${currentTag} (likely !done after !empty)`);
    this.cleanUp();
  }
};

/**
 * Gets MikroTik credentials from the database.
 */
async function getMikrotikConfig() {
  const res = await query(`
    SELECT key, value 
    FROM system_settings 
    WHERE key IN ('mikrotik_host', 'mikrotik_port', 'mikrotik_user', 'mikrotik_pass')
  `);
  
  const config = {};
  res.rows.forEach(r => { config[r.key] = r.value; });
  
  return {
    host: config.mikrotik_host,
    port: parseInt(config.mikrotik_port) || 8728,
    user: config.mikrotik_user,
    password: config.mikrotik_pass || ''
  };
}

/**
 * Connects to MikroTik API and fetches real-time traffic for given PPPoE interfaces.
 * @param {string[]} pppoeUsers Array of PPPoE usernames
 * @returns {Promise<Object>} Map of username to traffic stats { rx: '... Kbps', tx: '... Kbps' }
 */
async function getTrafficForPPPoE(pppoeUsers) {
  if (!pppoeUsers || pppoeUsers.length === 0) return {};

  const config = await getMikrotikConfig();
  if (!config.host || !config.user) {
    throw new Error('Konfigurasi MikroTik API belum lengkap di Pengaturan Sistem');
  }

  const client = new RouterOSAPI({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    timeout: 3
  });
  client.on('error', (err) => {
    console.error('[MikroTik Error Event - getTrafficForPPPoE]:', err.message);
  });

  const trafficMap = {};
  let connected = false;

  try {
    await client.connect();
    connected = true;
    
    // Format the interface names: <pppoe-username>
    const interfaceNames = pppoeUsers.map(u => `<pppoe-${u}>`).join(',');
    
    // Query traffic
    const trafficStats = await client.write('/interface/monitor-traffic', [
      `=interface=${interfaceNames}`,
      '=once='
    ]);

    // Format output
    trafficStats.forEach(stat => {
      // name is e.g. "<pppoe-dindin>"
      const usernameMatch = stat.name.match(/<pppoe-(.+)>/);
      if (usernameMatch) {
        const username = usernameMatch[1];
        const rxBps = parseInt(stat['rx-bits-per-second']) || 0;
        const txBps = parseInt(stat['tx-bits-per-second']) || 0;
        
        trafficMap[username] = {
          rx: formatSpeed(rxBps),
          tx: formatSpeed(txBps),
          rawRxBps: rxBps,
          rawTxBps: txBps
        };
      }
    });

  } catch (err) {
    console.error('MikroTik API Error:', err.message);
    // Return empty map on error instead of throwing to prevent crashing the whole dashboard
  } finally {
    if (connected) client.close();
  }

  // Ensure all requested users have an entry, even if 0
  pppoeUsers.forEach(u => {
    if (!trafficMap[u]) {
      trafficMap[u] = { rx: '0 Kbps', tx: '0 Kbps', rawRxBps: 0, rawTxBps: 0 };
    }
  });

  return trafficMap;
}

/**
 * Formats bps into Kbps or Mbps
 */
function formatSpeed(bps) {
  if (bps >= 1000000) {
    return (bps / 1000000).toFixed(1) + ' Mbps';
  } else {
    return (bps / 1000).toFixed(1) + ' Kbps';
  }
}

/**
 * Disconnects an active PPPoE user from MikroTik.
 */
async function disconnectPPPoEUser(username) {
  const config = await getMikrotikConfig();
  if (!config.host || !config.user) return false;

  const client = new RouterOSAPI({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    timeout: 3
  });
  client.on('error', (err) => {
    console.error('[MikroTik Error Event - disconnectPPPoEUser]:', err.message);
  });

  try {
    await client.connect();
    
    // Find active connection
    const active = await client.write('/ppp/active/print', [
      `?name=${username}`
    ]);

    if (active.length > 0) {
      // Remove connection
      try {
        await client.write('/ppp/active/remove', [
          `=.id=${active[0]['.id']}`
        ]);
        console.log(`[MikroTik] Disconnected PPPoE user ${username}`);
      } catch (e) {
        if (e.message && e.message.includes('!empty')) {
          console.log(`[MikroTik] Disconnected PPPoE user ${username} (ignored !empty)`);
        } else {
          throw e;
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('[MikroTik] Error disconnecting user:', err.message);
    return false;
  } finally {
    client.close();
  }
}

/**
 * Setup Web-Proxy and Firewall rules for Isolir.
 */
async function setupIsolirRules(appIp) {
  const config = await getMikrotikConfig();
  if (!config.host || !config.user) throw new Error('Konfigurasi MikroTik belum lengkap.');

  const client = new RouterOSAPI({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    timeout: 3
  });
  client.on('error', (err) => {
    console.error('[MikroTik Error Event - setupIsolirRules]:', err.message);
  });

  try {
    await client.connect();
    
    const ensureEntity = async (path, nameField, nameValue, addParams) => {
      try {
        const existing = await client.write(`${path}/print`, [`?${nameField}=${nameValue}`]);
        if (existing.length === 0) {
          await client.write(`${path}/add`, addParams);
          console.log(`[MikroTik] Added ${path} -> ${nameValue}`);
        }
      } catch (err) {
        console.warn(`[MikroTik] Note: Ensure failed for ${path} -> ${nameValue}. Error:`, err.message);
      }
    };

    const removeByComment = async (path, comment) => {
      try {
        const existing = await client.write(`${path}/print`, [`?comment=${comment}`]);
        for (const item of existing) {
          await client.write(`${path}/remove`, ['.id=' + item['.id']]);
          console.log(`[MikroTik] Removed existing ${path} -> ${comment}`);
        }
      } catch (err) {
        console.warn(`[MikroTik] Note: Remove failed for ${path} -> ${comment}. Error:`, err.message);
      }
    };

    // Parse host and port from appIp (e.g., "167.71.200.190:3001" -> host: "167.71.200.190", port: "3001")
    let host = appIp;
    let portSuffix = '';
    if (appIp.includes(':')) {
      const parts = appIp.split(':');
      host = parts[0];
      portSuffix = ':' + parts[1];
    }

    const isPrivateIP = (ip) => {
      if (!/^[0-9.]+$/.test(ip)) return false;
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4) return false;
      return (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
      );
    };

    const isDomain = ip => ip.includes('.') && !/^[0-9.]+$/.test(ip);
    const protocol = isDomain(host) ? 'https' : 'http';
    const isolirUrl = `${protocol}://${host}${portSuffix}/isolir.html`;

    // 1. Aktifkan Web Proxy di port 8080
    try {
      await client.write('/ip/proxy/set', [
        '=enabled=yes',
        '=port=8080'
      ]);
      console.log('[MikroTik] Web Proxy enabled on port 8080');
    } catch (e) {
      console.warn('[MikroTik] Failed to set Web Proxy:', e.message);
    }

    // Clean up old rules to prevent duplicate or conflicting configurations
    await removeByComment('/ip/proxy/access', 'Isolir-Proxy-Redirect');
    await removeByComment('/ip/firewall/address-list', 'Isolir-Allowed-Billing');
    await removeByComment('/ip/firewall/nat', 'Isolir-NAT-HTTP');
    await removeByComment('/ip/firewall/nat', 'Isolir-Port-Forward');
    await removeByComment('/ip/firewall/nat', 'Isolir-Masq-Billing');
    await removeByComment('/ip/firewall/filter', 'Isolir-Allow-DNS');
    await removeByComment('/ip/firewall/filter', 'Isolir-Allow-Billing');
    await removeByComment('/ip/firewall/filter', 'Isolir-Drop-Internet');

    // 2. Proxy Access Rule: Redirect to Billing App Isolir page
    await ensureEntity('/ip/proxy/access', 'comment', 'Isolir-Proxy-Redirect', [
      '=action=redirect',
      `=action-data=${isolirUrl}`,
      '=comment=Isolir-Proxy-Redirect'
    ]);

    // 2b. Address List: Tambahkan host ke daftar ALLOWED-ISOLIR
    await ensureEntity('/ip/firewall/address-list', 'comment', 'Isolir-Allowed-Billing', [
      '=list=ALLOWED-ISOLIR',
      `=address=${host}`,
      '=comment=Isolir-Allowed-Billing'
    ]);

    // 3. NAT Redirect: Belokkan HTTP (Port 80) ke Web Proxy (8080), kecuali tujuan ke ALLOWED-ISOLIR
    await ensureEntity('/ip/firewall/nat', 'comment', 'Isolir-NAT-HTTP', [
      '=chain=dstnat',
      '=src-address-list=ISOLIR',
      '=dst-address-list=!ALLOWED-ISOLIR',
      '=protocol=tcp',
      '=dst-port=80',
      '=action=redirect',
      '=to-ports=8080',
      '=comment=Isolir-NAT-HTTP'
    ]);

    // Hanya terapkan Port Forward & Masquerade lokal jika IP merupakan IP privat (Server lokal)
    if (isPrivateIP(host)) {
      // 3b. Port Forward: Teruskan traffic ke http://${host}/ (port 80) ke port 3001
      await ensureEntity('/ip/firewall/nat', 'comment', 'Isolir-Port-Forward', [
        '=chain=dstnat',
        '=protocol=tcp',
        `=dst-address=${host}`,
        '=dst-port=80',
        '=action=dst-nat',
        '=to-ports=3001',
        '=comment=Isolir-Port-Forward'
      ]);

      // 3c. Masquerade Internal: Cegah asymmetric routing untuk koneksi dari klien ke host
      await ensureEntity('/ip/firewall/nat', 'comment', 'Isolir-Masq-Billing', [
        '=chain=srcnat',
        `=dst-address=${host}`,
        '=action=masquerade',
        '=comment=Isolir-Masq-Billing'
      ]);
    }

    // 4. Filter Rules: Izinkan DNS, Izinkan Akses ke Billing, Drop sisanya
    await ensureEntity('/ip/firewall/filter', 'comment', 'Isolir-Allow-DNS', [
      '=chain=forward',
      '=src-address-list=ISOLIR',
      '=protocol=udp',
      '=dst-port=53',
      '=action=accept',
      '=comment=Isolir-Allow-DNS'
    ]);

    await ensureEntity('/ip/firewall/filter', 'comment', 'Isolir-Allow-Billing', [
      '=chain=forward',
      '=src-address-list=ISOLIR',
      '=dst-address-list=ALLOWED-ISOLIR',
      '=action=accept',
      '=comment=Isolir-Allow-Billing'
    ]);

    await ensureEntity('/ip/firewall/filter', 'comment', 'Isolir-Drop-Internet', [
      '=chain=forward',
      '=src-address-list=ISOLIR',
      '=action=drop',
      '=comment=Isolir-Drop-Internet'
    ]);

    return true;
  } catch (err) {
    console.error('[MikroTik] Error setting up Web-Proxy Isolir:', err.message);
    throw new Error('Gagal mengatur Isolir Web-Proxy di MikroTik: ' + err.message);
  } finally {
    client.close();
  }
}

/**
 * Adds a bypassed IP binding in MikroTik for a hotspot user's MAC address.
 */
async function addHotspotBypass(mac, username) {
  if (!mac) return false;
  const config = await getMikrotikConfig();
  if (!config.host || !config.user) return false;

  const client = new RouterOSAPI({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    timeout: 3
  });
  client.on('error', (err) => {
    console.error('[MikroTik Error Event - addHotspotBypass]:', err.message);
  });

  try {
    await client.connect();

    const comment = `Bypassed Member: ${username}`;
    
    // 1. Check if binding already exists for this user (by comment)
    const existing = await client.write('/ip/hotspot/ip-binding/print', [
      `?comment=${comment}`
    ]);

    if (existing.length > 0) {
      if (existing[0]['mac-address'] === mac) {
        console.log(`[MikroTik] IP binding for member ${username} already exists and matches MAC ${mac}`);
        return true;
      }
      try {
        await client.write('/ip/hotspot/ip-binding/remove', [
          `=.id=${existing[0]['.id']}`
        ]);
        console.log(`[MikroTik] Removed outdated IP binding for member ${username}`);
      } catch (e) {}
    }

    // 2. Check if MAC is bound by another rule (avoid conflicts)
    const existingMac = await client.write('/ip/hotspot/ip-binding/print', [
      `?mac-address=${mac}`
    ]);
    if (existingMac.length > 0) {
      try {
        await client.write('/ip/hotspot/ip-binding/remove', [
          `=.id=${existingMac[0]['.id']}`
        ]);
        console.log(`[MikroTik] Removed conflicting IP binding for MAC ${mac}`);
      } catch (e) {}
    }

    // 3. Add bypassed binding
    await client.write('/ip/hotspot/ip-binding/add', [
      `=mac-address=${mac}`,
      `=type=bypassed`,
      `=comment=${comment}`
    ]);
    console.log(`[MikroTik] Added bypassed IP binding for member ${username} with MAC ${mac}`);
    return true;
  } catch (err) {
    console.error('[MikroTik] Error adding bypassed IP binding:', err.message);
    return false;
  } finally {
    client.close();
  }
}

/**
 * Removes the bypassed IP binding in MikroTik for a hotspot user.
 */
async function removeHotspotBypass(username) {
  const config = await getMikrotikConfig();
  if (!config.host || !config.user) return false;

  const client = new RouterOSAPI({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    timeout: 3
  });
  client.on('error', (err) => {
    console.error('[MikroTik Error Event - removeHotspotBypass]:', err.message);
  });

  try {
    await client.connect();

    const comment = `Bypassed Member: ${username}`;
    const existing = await client.write('/ip/hotspot/ip-binding/print', [
      `?comment=${comment}`
    ]);

    if (existing.length > 0) {
      for (const item of existing) {
        try {
          await client.write('/ip/hotspot/ip-binding/remove', [
            `=.id=${item['.id']}`
          ]);
          console.log(`[MikroTik] Removed bypassed IP binding for member ${username}`);
        } catch (e) {}
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('[MikroTik] Error removing bypassed IP binding:', err.message);
    return false;
  } finally {
    client.close();
  }
}

module.exports = {
  getTrafficForPPPoE,
  disconnectPPPoEUser,
  setupIsolirRules,
  addHotspotBypass,
  removeHotspotBypass
};
