// ─── Voucher Logs Routes ─────────────────────────────────────────────────────
// Voucher HANGUS / Expired — Tabel terpisah dari vouchers aktif
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const db      = require('../db/pool');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// ── GET /api/voucher-logs — List expired vouchers ────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, q: search, reason, from, to } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push(`(vl.code ILIKE $${params.length + 1} OR vl.package_name ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }
  if (reason) {
    conditions.push(`vl.expire_reason = $${params.length + 1}`);
    params.push(reason);
  }
  if (from) {
    conditions.push(`vl.expired_at >= $${params.length + 1}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`vl.expired_at <= $${params.length + 1}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [dataRes, countRes] = await Promise.all([
    db.query(`
      SELECT
        vl.*,
        p.speed_upload, p.speed_download
      FROM voucher_logs vl
      LEFT JOIN packages p ON p.id = vl.package_id
      ${where}
      ORDER BY vl.expired_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), offset]),
    db.query(`SELECT COUNT(*) FROM voucher_logs vl ${where}`, params),
  ]);

  res.json({
    success: true,
    data: dataRes.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(countRes.rows[0].count),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
    },
  });
}));

// ── GET /api/voucher-logs/:id ─────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM voucher_logs WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Log voucher tidak ditemukan');
  res.json({ success: true, data: result.rows[0] });
}));

// ── GET /api/voucher-logs/summary — Statistics of expired vouchers ─────────────
router.get('/summary/stats', asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT
      COUNT(*)                                       AS total,
      COUNT(*) FILTER (WHERE expire_reason = 'auto')         AS auto_expired,
      COUNT(*) FILTER (WHERE expire_reason = 'admin_kick')   AS admin_kicked,
      COUNT(*) FILTER (WHERE expire_reason = 'manual')       AS manual,
      SUM(price)                                     AS total_revenue,
      SUM(used_bytes)                                AS total_bytes_used,
      DATE_TRUNC('month', expired_at) AS month,
      COUNT(*)                         AS count_per_month
    FROM voucher_logs
    GROUP BY DATE_TRUNC('month', expired_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  res.json({ success: true, data: result.rows });
}));

// ── DELETE /api/voucher-logs/:id — Delete log entry ─────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await db.query('DELETE FROM voucher_logs WHERE id = $1 RETURNING *', [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Log tidak ditemukan');
  res.json({ success: true, message: 'Log voucher dihapus' });
}));

// ── DELETE /api/voucher-logs/bulk — Bulk delete logs ─────────────────────────
router.delete('/bulk/delete', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw createError(400, 'IDs harus berupa array');
  const result = await db.query('DELETE FROM voucher_logs WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  res.json({ success: true, message: `${result.rows.length} log dihapus` });
}));

// ── DELETE /api/voucher-logs/clear/all — Clear all expired logs ──────────────
router.delete('/clear/all', asyncHandler(async (req, res) => {
  const result = await db.query('DELETE FROM voucher_logs RETURNING id');
  res.json({ success: true, message: `${result.rows.length} log voucher hangus dihapus semua` });
}));

module.exports = router;
