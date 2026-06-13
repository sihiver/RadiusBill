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
 * Injects the NAT redirect rules into MikroTik for the ISOLIR address list.
 */
async function setupIsolirRules(appIp) {
  const config = await getMikrotikConfig();
  if (!config.host || !config.user) throw new Error('Konfigurasi MikroTik belum lengkap.');

  let targetIp = appIp;
  let targetPort = '80'; // Default port
  
  if (appIp.includes(':')) {
    const parts = appIp.split(':');
    targetIp = parts[0];
    targetPort = parts[1];
  }

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
    
    // Check if rule already exists
    let existing = [];
    try {
      existing = await client.write('/ip/firewall/nat/print', [
        '?src-address-list=ISOLIR',
        '?action=dst-nat'
      ]);
    } catch (e) {
      if (e.message && e.message.includes('!empty')) {
        existing = [];
      } else {
        throw e;
      }
    }

    if (existing.length === 0) {
      try {
        await client.write('/ip/firewall/nat/add', [
          '=chain=dstnat',
          '=src-address-list=ISOLIR',
          '=protocol=tcp',
          '=dst-port=80,443',
          '=action=dst-nat',
          `=to-addresses=${targetIp}`,
          `=to-ports=${targetPort}`,
          '=comment=Billing-Radius-Isolir-Redirect'
        ]);
        console.log(`[MikroTik] Injected ISOLIR NAT Rule pointing to ${targetIp}:${targetPort}`);
      } catch (e) {
        if (e.message && e.message.includes('!empty')) {
          console.log(`[MikroTik] Injected ISOLIR NAT Rule pointing to ${targetIp}:${targetPort} (ignored !empty)`);
        } else {
          throw e;
        }
      }
    } else {
      // Update existing rule
      try {
        await client.write('/ip/firewall/nat/set', [
          `=.id=${existing[0]['.id']}`,
          `=to-addresses=${targetIp}`,
          `=to-ports=${targetPort}`
        ]);
        console.log(`[MikroTik] Updated ISOLIR NAT Rule pointing to ${targetIp}:${targetPort}`);
      } catch (e) {
        if (e.message && e.message.includes('!empty')) {
          console.log(`[MikroTik] Updated ISOLIR NAT Rule pointing to ${targetIp}:${targetPort} (ignored !empty)`);
        } else {
          throw e;
        }
      }
    }
    
    // Ensure rule is at the top (order 0)
    const newRule = await client.write('/ip/firewall/nat/print', [
      '?src-address-list=ISOLIR',
      '?action=dst-nat'
    ]);
    if (newRule.length > 0) {
      try {
        await client.write('/ip/firewall/nat/move', [
          `=numbers=${newRule[0]['.id']}`,
          '=destination=0'
        ]);
      } catch (e) {
        if (e.message && e.message.includes('!empty')) {
          // ignore
        } else {
          throw e;
        }
      }
    }

    return true;
  } catch (err) {
    console.error('[MikroTik] Error setting up isolir rules:', err.message);
    throw err;
  } finally {
    client.close();
  }
}

module.exports = {
  getTrafficForPPPoE,
  disconnectPPPoEUser,
  setupIsolirRules
};
