// ─── FreeRADIUS Service ───────────────────────────────────────────────────────
// Manages radcheck / radreply / radusergroup tables
// FreeRADIUS reads these tables for authentication & authorization
// ─────────────────────────────────────────────────────────────────────────────
const { query, getClient } = require('../db/pool');

/**
 * Sync a user to FreeRADIUS:
 * - Upsert radcheck with Cleartext-Password
 * - Assign to group (for group policies)
 * - Set reply attributes based on package speed
 *
 * @param {string} username
 * @param {string} password   (plain text — FreeRADIUS will use Cleartext-Password)
 * @param {string} groupName  e.g. 'hotspot-5mbps', 'pppoe-10mbps'
 * @param {object} replyAttrs e.g. { 'Mikrotik-Rate-Limit': '2M/5M' }
 */
async function syncUserToRadius(username, password, groupName, replyAttrs = {}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Upsert radcheck — Cleartext-Password
    await client.query(`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES ($1, 'Cleartext-Password', ':=', $2)
      ON CONFLICT DO NOTHING
    `, [username, password]);

    // Update password if already exists
    await client.query(`
      UPDATE radcheck SET value = $2
      WHERE username = $1 AND attribute = 'Cleartext-Password'
    `, [username, password]);

    // 2. Assign group
    if (groupName) {
      await client.query(`
        INSERT INTO radusergroup (username, groupname, priority)
        VALUES ($1, $2, 1)
        ON CONFLICT DO NOTHING
      `, [username, groupName]);
    }

    // 3. Set reply attributes (speed limits, etc.)
    if (Object.keys(replyAttrs).length > 0) {
      // Remove old reply attrs for this user first
      await client.query(`DELETE FROM radreply WHERE username = $1`, [username]);
      // Insert new ones
      for (const [attr, val] of Object.entries(replyAttrs)) {
        await client.query(`
          INSERT INTO radreply (username, attribute, op, value)
          VALUES ($1, $2, ':=', $3)
        `, [username, attr, val]);
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove a user from all FreeRADIUS tables.
 */
async function removeUserFromRadius(username) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM radcheck     WHERE username = $1`, [username]);
    await client.query(`DELETE FROM radreply     WHERE username = $1`, [username]);
    await client.query(`DELETE FROM radusergroup WHERE username = $1`, [username]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Isolir a PPPoE user: assign Mikrotik-Address-List = ISOLIR and limit speed.
 * This allows the user to stay connected but redirected by firewall.
 */
async function isolirUser(username, reason = '') {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Ensure no old Reject Auth-Type or old Address-List
    await client.query(`DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type'`, [username]);
    await client.query(`DELETE FROM radreply WHERE username = $1 AND attribute IN ('Mikrotik-Address-List', 'Mikrotik-Rate-Limit')`, [username]);
    
    // Insert new Isolir parameters
    await client.query(`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES ($1, 'Mikrotik-Address-List', ':=', 'ISOLIR')
    `, [username]);
    
    await client.query(`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES ($1, 'Mikrotik-Rate-Limit', ':=', '128k/128k')
    `, [username]);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reject a user completely with a custom message.
 * Clears old settings and sets Auth-Type = Reject and Reply-Message.
 */
async function rejectUserWithReason(username, message) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Clear old auth/reply attributes and groups
    await client.query(`DELETE FROM radcheck     WHERE username = $1`, [username]);
    await client.query(`DELETE FROM radreply     WHERE username = $1`, [username]);
    await client.query(`DELETE FROM radusergroup WHERE username = $1`, [username]);
    
    // Set Reject & Custom Message
    await client.query(`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES ($1, 'Auth-Type', ':=', 'Reject')
    `, [username]);
    
    await client.query(`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES ($1, 'Reply-Message', ':=', $2)
    `, [username, message]);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove isolir: delete Address-List.
 * Note: After calling this, the caller must re-sync the user's package Rate-Limit.
 */
async function unisolirUser(username) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type'`, [username]);
    await client.query(`DELETE FROM radreply WHERE username = $1 AND attribute = 'Mikrotik-Address-List'`, [username]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get all currently active sessions from radacct.
 */
async function getActiveSessions() {
  const res = await query(`
    SELECT
      ra.radacctid,
      ra.username,
      ra.framedipaddress   AS ip_address,
      ra.callingstationid  AS mac_address,
      ra.nasipaddress      AS nas_ip,
      ra.acctstarttime     AS started_at,
      ra.acctsessiontime   AS session_secs,
      ra.acctinputoctets   AS input_octets,
      ra.acctoutputoctets  AS output_octets,
      (ra.acctinputoctets + ra.acctoutputoctets) AS total_bytes
    FROM radacct ra
    WHERE ra.acctstoptime IS NULL
    ORDER BY ra.acctstarttime DESC
  `);
  return res.rows;
}

/**
 * Get recent postauth log (last N entries).
 */
async function getRecentPostauth(limit = 50) {
  const res = await query(`
    SELECT id, username, reply, authdate, callingstationid AS mac_address
    FROM radpostauth
    ORDER BY authdate DESC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

/**
 * Build the group name from a package.
 * @param {object} pkg  Package object { type, speed_upload, speed_download, name }
 */
function buildGroupName(pkg) {
  // e.g. "hotspot-5mbps" or "pppoe-10mbps"
  const type = pkg.type.toLowerCase();
  const dl   = (pkg.speed_download || '').replace(/\s+/g, '').toLowerCase();
  return `${type}-${dl}`.replace(/[^a-z0-9-]/g, '');
}

/**
 * Build Mikrotik-Rate-Limit value from package speeds.
 * Format: "UL/DL" e.g. "2M/5M"
 */
function buildRateLimit(pkg) {
  const ul = (pkg.speed_upload   || '1 Mbps').replace(/\s+Mbps/i, 'M').replace(/\s+Kbps/i, 'K').replace(/\s/g, '');
  const dl = (pkg.speed_download || '5 Mbps').replace(/\s+Mbps/i, 'M').replace(/\s+Kbps/i, 'K').replace(/\s/g, '');
  return `${ul}/${dl}`;
}

/**
 * Ensure group reply attributes exist for a package group.
 * Called once when a package is created/updated.
 */
async function ensureGroupPolicy(pkg) {
  const groupName  = buildGroupName(pkg);
  const rateLimit  = buildRateLimit(pkg);



  // Remove old group reply attrs and re-insert
  await query(`DELETE FROM radgroupreply WHERE groupname = $1`, [groupName]);
  await query(`
    INSERT INTO radgroupreply (groupname, attribute, op, value)
    VALUES ($1, 'Mikrotik-Rate-Limit', '=', $2)
  `, [groupName, rateLimit]);

  return groupName;
}

/**
 * Send a RADIUS Disconnect-Request (PoD) to the NAS using radclient.
 * @param {string} username     Voucher code or member username
 * @param {string} nasIp        IP address of the NAS (Mikrotik)
 * @param {string} sessionId    Acct-Session-Id (optional)
 * @param {string} framedIp     Framed-IP-Address (optional)
 */
async function sendDisconnectRequest(username, nasIp, sessionId, framedIp) {
  const { exec } = require('child_process');
  
  let secret = 'testing123'; // fallback
  try {
    const nasRes = await query('SELECT secret FROM nas WHERE nasname = $1', [nasIp]);
    if (nasRes.rows[0]) {
      secret = nasRes.rows[0].secret;
    }
  } catch (err) {
    console.error('[RadiusService] Error fetching NAS secret:', err.message);
  }

  const port = 3799;
  let input = `User-Name = "${username}"`;
  if (sessionId) {
    input += `, Acct-Session-Id = "${sessionId}"`;
  }
  if (framedIp && framedIp !== '-') {
    input += `, Framed-IP-Address = "${framedIp}"`;
  }

  const cmd = `echo '${input}' | radclient -t 2 -r 2 -x ${nasIp}:${port} disconnect '${secret}'`;
  console.log('[RadiusService] Executing disconnect command:', cmd);

  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[RadiusService] Disconnect error: ${error.message}`);
        console.error(`[RadiusService] stderr: ${stderr}`);
        resolve(false);
      } else {
        console.log(`[RadiusService] Disconnect success stdout: ${stdout}`);
        resolve(true);
      }
    });
  });
}

module.exports = {
  syncUserToRadius,
  removeUserFromRadius,
  rejectUserWithReason,
  isolirUser,
  unisolirUser,
  getActiveSessions,
  getRecentPostauth,
  buildGroupName,
  buildRateLimit,
  ensureGroupPolicy,
  sendDisconnectRequest,
};
