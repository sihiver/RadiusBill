// ─── FreeRADIUS Routes ────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const db      = require('../db/pool');
const { cacheAside, cacheDelPattern, TTL } = require('../services/cacheService');
const radius  = require('../services/radiusService');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/radius/status — Status koneksi DB + server
router.get('/status', asyncHandler(async (req, res) => {
  const start = Date.now();
  let dbOk = false, dbMs = 0;
  let redisOk = false;

  // Test PostgreSQL
  try {
    await db.testConnection();
    dbOk = true;
    dbMs = Date.now() - start;
  } catch (e) {
    dbOk = false;
  }

  // Test Redis
  try {
    const { getRedisClient } = require('../db/redis');
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.ping();
      redisOk = true;
    }
  } catch { redisOk = false; }

  // Count active sessions
  let activeSessions = 0;
  try {
    const sessRes = await db.query(`SELECT COUNT(*) FROM radacct WHERE acctstoptime IS NULL`);
    activeSessions = parseInt(sessRes.rows[0].count);
  } catch { /* non-fatal */ }

  res.json({
    success: true,
    data: {
      status:           dbOk ? 'Connected' : 'Disconnected',
      database_ok:      dbOk,
      database_latency: dbMs,
      redis_ok:         redisOk,
      active_sessions:  activeSessions,
      server_time:      new Date().toISOString(),
    }
  });
}));

// GET /api/radius/sessions — Sesi aktif dari radacct
router.get('/sessions', asyncHandler(async (req, res) => {
  const sessions = await cacheAside('radius:sessions', async () => {
    return radius.getActiveSessions();
  }, 15); // 15 second TTL (real-time-ish)

  res.json({ success: true, data: sessions });
}));

// POST /api/radius/sessions/:id/disconnect — Terminate active radacct session
router.post('/sessions/:id/disconnect', asyncHandler(async (req, res) => {
  const radacctid = req.params.id;
  
  // Find session to get username and connection details
  const sessRes = await db.query('SELECT username, nasipaddress::text, acctsessionid, framedipaddress::text AS framed_ip FROM radacct WHERE radacctid = $1', [radacctid]);
  if (!sessRes.rows[0]) {
    return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
  }
  const { username, nasipaddress, acctsessionid, framed_ip } = sessRes.rows[0];

  // Send physical disconnect command to NAS (Mikrotik)
  if (nasipaddress) {
    await radius.sendDisconnectRequest(username, nasipaddress, acctsessionid, framed_ip);
  }

  // Terminate session in radacct
  await db.query(`
    UPDATE radacct
    SET acctstoptime = NOW(), acctterminatecause = 'Admin Reset'
    WHERE radacctid = $1
  `, [radacctid]);

  // Update member state if it is a member
  await db.query(`
    UPDATE members
    SET active_session = FALSE, ip_address = NULL, session_start = NULL
    WHERE username = $1
  `, [username]);

  const { cacheDelPattern } = require('../services/cacheService');
  await cacheDelPattern('radius:*');
  await cacheDelPattern('members:*');
  await cacheDelPattern('dashboard:*');

  res.json({ success: true, message: 'Sesi RADIUS berhasil diputus' });
}));

// GET /api/radius/logs — Recent postauth + accounting logs
router.get('/logs', asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;

  const data = await cacheAside(`radius:logs:${limit}`, async () => {
    // Combine postauth (Auth/Reject) and recent accounting events
    const [postauth, acctStart, acctStop] = await Promise.all([
      db.query(`
        SELECT
          'AUTH'   AS type,
          username,
          CASE WHEN reply = 'Access-Accept' THEN 'AUTH' ELSE 'REJECT' END AS log_type,
          reply,
          NULL AS action,
          callingstationid AS mac_address,
          NULL AS ip_address,
          NULL AS session_id,
          authdate         AS created_at
        FROM radpostauth
        ORDER BY authdate DESC
        LIMIT $1
      `, [parseInt(limit)]),
      db.query(`
        SELECT
          'ACCT'              AS type,
          username,
          'ACCT'              AS log_type,
          NULL                AS reply,
          'Start'             AS action,
          callingstationid    AS mac_address,
          framedipaddress::text AS ip_address,
          acctsessionid       AS session_id,
          acctstarttime       AS created_at
        FROM radacct
        ORDER BY acctstarttime DESC
        LIMIT $1
      `, [Math.min(parseInt(limit), 20)]),
      db.query(`
        SELECT
          'ACCT'              AS type,
          username,
          'ACCT'              AS log_type,
          acctterminatecause  AS reply,
          'Stop'              AS action,
          callingstationid    AS mac_address,
          framedipaddress::text AS ip_address,
          acctsessionid       AS session_id,
          acctstoptime        AS created_at
        FROM radacct
        WHERE acctstoptime IS NOT NULL
        ORDER BY acctstoptime DESC
        LIMIT $1
      `, [Math.min(parseInt(limit), 20)])
    ]);

    const combined = [...postauth.rows, ...acctStart.rows, ...acctStop.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, parseInt(limit));

    return combined;
  }, TTL.RADIUS_LOGS);

  res.json({ success: true, data });
}));

// POST /api/radius/sync — Full re-sync all users to radcheck/radreply
router.post('/sync', asyncHandler(async (req, res) => {
  let synced = 0;
  const errors = [];

  // Sync all active vouchers
  const vouchers = await db.query(`
    SELECT v.*, p.type, p.speed_upload, p.speed_download, p.name AS pkg_name
    FROM vouchers v
    LEFT JOIN packages p ON p.id = v.package_id
    WHERE v.status IN ('Unused', 'Active')
  `);

  for (const v of vouchers.rows) {
    try {
      const groupName = v.type ? radius.buildGroupName(v) : 'hotspot-general';
      const rateLimit = v.speed_upload ? radius.buildRateLimit(v) : '1M/5M';
      await radius.syncUserToRadius(v.code, v.password, groupName, {
        'Mikrotik-Rate-Limit': rateLimit
      });
      synced++;
    } catch (e) {
      errors.push({ user: v.code, error: e.message });
    }
  }

  // Sync all active members
  const members = await db.query(`
    SELECT m.*, p.type, p.speed_upload, p.speed_download
    FROM members m
    LEFT JOIN packages p ON p.id = m.package_id
    WHERE m.is_active = TRUE
  `);

  for (const m of members.rows) {
    try {
      const groupName = m.type ? radius.buildGroupName(m) : 'hotspot-member';
      const rateLimit = m.speed_upload ? radius.buildRateLimit(m) : '1M/5M';
      await radius.syncUserToRadius(m.username, m.password, groupName, {
        'Mikrotik-Rate-Limit': rateLimit
      });
      synced++;
    } catch (e) {
      errors.push({ user: m.username, error: e.message });
    }
  }

  // Sync all routers (PPPoE)
  const routers = await db.query(`
    SELECT r.*, p.type, p.speed_upload, p.speed_download
    FROM routers r
    LEFT JOIN packages p ON p.id = r.package_id
  `);

  for (const r of routers.rows) {
    try {
      const groupName = r.type ? radius.buildGroupName(r) : 'pppoe-general';
      const rateLimit = r.speed_upload ? radius.buildRateLimit(r) : '3M/10M';
      await radius.syncUserToRadius(r.pppoe_user, r.pppoe_pass, groupName, {
        'Mikrotik-Rate-Limit': rateLimit
      });
      // Re-apply isolir if needed
      if (r.isolir) await radius.isolirUser(r.pppoe_user);
      synced++;
    } catch (e) {
      errors.push({ user: r.pppoe_user, error: e.message });
    }
  }

  await cacheDelPattern('radius:*');

  res.json({
    success: true,
    data: { synced, errors },
    message: `Sinkronisasi selesai: ${synced} user di-sync ke FreeRADIUS`,
  });
}));

module.exports = router;
