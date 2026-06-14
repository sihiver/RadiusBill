const express = require('express');
const router  = express.Router();
const db      = require('../db/pool');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/reports/revenue
// Get revenue statistics from transactions table, optionally filtered by month (YYYY-MM)
router.get('/revenue', asyncHandler(async (req, res) => {
  const monthParam = req.query.month;
  let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
  let params = [];
  
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    dateFilter = "DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $1::date)";
    params.push(`${monthParam}-01`);
  }

  const result = await db.query(`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM-DD') as date,
      type,
      SUM(amount) as total_amount,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE ${dateFilter}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), type
    ORDER BY date DESC
  `, params);

  res.json({ success: true, data: result.rows });
}));

// GET /api/reports/summary
// Get overall summary, revenue scaled by requested month
router.get('/summary', asyncHandler(async (req, res) => {
  const monthParam = req.query.month;
  let monthFilterStr = "DATE_TRUNC('month', NOW())";
  let params = [];
  
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    monthFilterStr = "DATE_TRUNC('month', $1::date)";
    params.push(`${monthParam}-01`);
  }

  const result = await db.query(`
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE_TRUNC('month', created_at) = ${monthFilterStr}) as revenue_this_month,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', NOW())) as revenue_today,
      (SELECT COUNT(*) FROM vouchers WHERE status = 'Active') as active_vouchers,
      (SELECT COUNT(*) FROM members WHERE is_active = TRUE) as active_members,
      (SELECT COUNT(*) FROM routers WHERE status = 'Online') as active_routers
  `, params);

  res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;
