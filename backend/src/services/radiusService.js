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
 * Isolir a PPPoE user: add Auth-Type = Reject to radcheck.
 * FreeRADIUS will reject all authentication attempts for this user.
 */
async function isolirUser(username, reason = '') {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Remove existing Auth-Type for this user
    await client.query(`
      DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type'
    `, [username]);
    // Insert Auth-Type = Reject
    await client.query(`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES ($1, 'Auth-Type', ':=', 'Reject')
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
 * Remove isolir: delete Auth-Type = Reject from radcheck.
 */
async function unisolirUser(username) {
  await query(`
    DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type'
  `, [username]);
  return true;
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

  // Upsert group check — always allow auth at group level
  await query(`
    INSERT INTO radgroupcheck (groupname, attribute, op, value)
    VALUES ($1, 'Auth-Type', ':=', 'Local')
    ON CONFLICT DO NOTHING
  `, [groupName]);

  // Remove old group reply attrs and re-insert
  await query(`DELETE FROM radgroupreply WHERE groupname = $1`, [groupName]);
  await query(`
    INSERT INTO radgroupreply (groupname, attribute, op, value)
    VALUES ($1, 'Mikrotik-Rate-Limit', '=', $2)
  `, [groupName, rateLimit]);

  return groupName;
}

module.exports = {
  syncUserToRadius,
  removeUserFromRadius,
  isolirUser,
  unisolirUser,
  getActiveSessions,
  getRecentPostauth,
  buildGroupName,
  buildRateLimit,
  ensureGroupPolicy,
};
