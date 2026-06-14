// ─── Dashboard Routes ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const db      = require('../db/pool');
const { cacheAside, TTL } = require('../services/cacheService');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/dashboard/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const data = await cacheAside('dashboard:stats', async () => {
    const [vStats, mStats, rStats, sessionStats, revenueStats, trendStats] = await Promise.all([
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
      // Monthly revenue from transactions
      db.query(`
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS revenue_this_month,
          (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')) AS revenue_last_month
      `),
      // Revenue trend (last 7 days)
      db.query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as date,
          type,
          SUM(amount) as amount
        FROM transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), type
        ORDER BY date ASC
      `),
    ]);

    // Calculate revenue growth percentage
    let revGrowth = 0;
    const thisMonth = Number(revenueStats.rows[0].revenue_this_month);
    const lastMonth = Number(revenueStats.rows[0].revenue_last_month);
    if (lastMonth > 0) {
      revGrowth = ((thisMonth - lastMonth) / lastMonth) * 100;
    } else if (thisMonth > 0) {
      revGrowth = 100; // 100% growth if there was 0 last month but some this month
    }

    return {
      vouchers: vStats.rows[0],
      members:  mStats.rows[0],
      routers:  rStats.rows[0],
      sessions: sessionStats.rows[0],
      revenue:  {
        this_month: thisMonth,
        last_month: lastMonth,
        growth_percentage: revGrowth
      },
      revenueTrend: trendStats.rows,
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
