// ─── Dashboard Routes ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const db      = require('../db/pool');
const { cacheAside, TTL } = require('../services/cacheService');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/dashboard/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const data = await cacheAside('dashboard:stats', async () => {
    const [vStats, mStats, rStats, sessionStats, revenueStats] = await Promise.all([
      // Voucher stats
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'Active')  AS active_vouchers,
          COUNT(*) FILTER (WHERE status = 'Unused')  AS unused_vouchers,
          (SELECT COUNT(*) FROM voucher_logs)         AS expired_vouchers
        FROM vouchers
      `),
      // Member stats
      db.query(`
        SELECT
          COUNT(*) AS total_members,
          COUNT(*) FILTER (WHERE active_session = TRUE)      AS online_members,
          COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired_members
        FROM members WHERE is_active = TRUE
      `),
      // Router stats
      db.query(`
        SELECT
          COUNT(*)                                          AS total_routers,
          COUNT(*) FILTER (WHERE status = 'Online')         AS online_routers,
          COUNT(*) FILTER (WHERE status = 'Isolated')       AS isolated_routers
        FROM routers
      `),
      // Active sessions from radacct
      db.query(`
        SELECT COUNT(*) AS active_sessions,
               SUM(acctinputoctets + acctoutputoctets) AS total_bytes
        FROM radacct WHERE acctstoptime IS NULL
      `),
      // Monthly revenue from voucher_logs
      db.query(`
        SELECT
          COALESCE(SUM(price), 0) AS revenue_this_month
        FROM voucher_logs
        WHERE expired_at >= DATE_TRUNC('month', NOW())
      `),
    ]);

    return {
      vouchers: vStats.rows[0],
      members:  mStats.rows[0],
      routers:  rStats.rows[0],
      sessions: sessionStats.rows[0],
      revenue:  revenueStats.rows[0],
    };
  }, TTL.STATS);

  res.json({ success: true, data });
}));

// GET /api/dashboard/recent-activity — Last 20 radius_logs
router.get('/recent-activity', asyncHandler(async (req, res) => {
  const data = await cacheAside('dashboard:activity', async () => {
    const result = await db.query(`
      SELECT id, log_type, username, ip_address, service, action, reason, message, created_at
      FROM radius_logs
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return result.rows;
  }, 30);

  res.json({ success: true, data });
}));

// POST /api/dashboard/log — Add system log entry
router.post('/log', asyncHandler(async (req, res) => {
  const { log_type, username, ip_address, service, action, reason, message } = req.body;

  await db.query(`
    INSERT INTO radius_logs (log_type, username, ip_address, service, action, reason, message)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [log_type || 'SYSTEM', username, ip_address, service, action, reason, message]);

  res.status(201).json({ success: true, message: 'Log ditambahkan' });
}));

module.exports = router;
