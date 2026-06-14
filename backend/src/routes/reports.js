const express = require('express');
const router  = express.Router();
const db      = require('../db/pool');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/reports/revenue
// Get revenue statistics from transactions table
router.get('/revenue', asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM-DD') as date,
      type,
      SUM(amount) as total_amount,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), type
    ORDER BY date DESC
  `);

  res.json({ success: true, data: result.rows });
}));

// GET /api/reports/summary
// Get overall summary
router.get('/summary', asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) as revenue_this_month,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', NOW())) as revenue_today,
      (SELECT COUNT(*) FROM vouchers WHERE status = 'Active') as active_vouchers,
      (SELECT COUNT(*) FROM members WHERE is_active = TRUE) as active_members,
      (SELECT COUNT(*) FROM routers WHERE status = 'Online') as active_routers
  `);

  res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;
