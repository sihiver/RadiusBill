const { RouterOSAPI } = require('node-routeros');
const { query } = require('../db/pool');

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

module.exports = {
  getTrafficForPPPoE
};
