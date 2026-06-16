const express = require('express');
const router = express.Router();
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// ── GET /api/resellers — List all resellers ───────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT id, username, role, balance, created_at FROM users WHERE role = 'reseller' ORDER BY created_at DESC`
  );
  res.json({ success: true, data: result.rows });
}));

// ── POST /api/resellers — Create new reseller ─────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).required(),
    balance: Joi.number().min(0).default(0)
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw error;

  const existing = await db.query('SELECT id FROM users WHERE username = $1', [value.username]);
  if (existing.rows.length > 0) throw createError(400, 'Username sudah digunakan');

  const hashedPassword = await bcrypt.hash(value.password, 10);
  const result = await db.query(
    `INSERT INTO users (username, password, role, balance) VALUES ($1, $2, 'reseller', $3) RETURNING id, username, role, balance, created_at`,
    [value.username, hashedPassword, value.balance]
  );
  
  res.status(201).json({ success: true, data: result.rows[0], message: 'Reseller berhasil ditambahkan' });
}));

// ── PUT /api/resellers/:id — Update reseller (password / balance top-up) ───
router.put('/:id', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    password: Joi.string().min(6).optional().allow(''),
    topup_balance: Joi.number().min(0).optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw error;

  // Check existence
  const existing = await db.query('SELECT * FROM users WHERE id = $1 AND role = $2', [req.params.id, 'reseller']);
  if (!existing.rows[0]) throw createError(404, 'Reseller tidak ditemukan');

  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (value.password) {
    const hashedPassword = await bcrypt.hash(value.password, 10);
    updates.push(`password = $${paramIndex++}`);
    params.push(hashedPassword);
  }

  if (value.topup_balance !== undefined && value.topup_balance > 0) {
    updates.push(`balance = balance + $${paramIndex++}`);
    params.push(value.topup_balance);
  }

  if (updates.length === 0) {
    return res.json({ success: true, data: existing.rows[0], message: 'Tidak ada perubahan' });
  }

  params.push(req.params.id);
  const result = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, role, balance, created_at`,
    params
  );

  res.json({ success: true, data: result.rows[0], message: 'Reseller berhasil diperbarui' });
}));

// ── DELETE /api/resellers/:id — Delete reseller ─────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(
    `DELETE FROM users WHERE id = $1 AND role = 'reseller' RETURNING id, username`,
    [req.params.id]
  );
  if (!result.rows[0]) throw createError(404, 'Reseller tidak ditemukan');
  res.json({ success: true, message: `Reseller ${result.rows[0].username} berhasil dihapus` });
}));

module.exports = router;
