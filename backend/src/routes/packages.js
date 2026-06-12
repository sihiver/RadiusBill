// ─── Packages Routes ──────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const db      = require('../db/pool');
const { cacheAside, cacheDel, cacheDelPattern, TTL } = require('../services/cacheService');
const radius  = require('../services/radiusService');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// Validation schema
const packageSchema = Joi.object({
  name:           Joi.string().max(100).required(),
  type:           Joi.string().valid('Hotspot', 'PPPoE').required(),
  speed_upload:   Joi.string().max(20).default('1 Mbps'),
  speed_download: Joi.string().max(20).default('5 Mbps'),
  duration:       Joi.string().max(50).default('Unlimited'),
  validity:       Joi.string().max(50).default('30 Hari'),
  price:          Joi.number().integer().min(0).required(),
  description:    Joi.string().max(500).allow('', null),
  is_active:      Joi.boolean().default(true),
});

// GET /api/packages
router.get('/', asyncHandler(async (req, res) => {
  const type = req.query.type; // optional filter: 'Hotspot' or 'PPPoE'
  const cacheKey = `packages:list:${type || 'all'}`;

  const data = await cacheAside(cacheKey, async () => {
    const conditions = ['is_active = TRUE'];
    const params = [];
    if (type) { conditions.push(`type = $${params.length + 1}`); params.push(type); }
    const q = `SELECT * FROM packages WHERE ${conditions.join(' AND ')} ORDER BY type, price`;
    const result = await db.query(q, params);
    return result.rows;
  }, TTL.PACKAGES);

  res.json({ success: true, data });
}));

// GET /api/packages/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM packages WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Paket tidak ditemukan');
  res.json({ success: true, data: result.rows[0] });
}));

// POST /api/packages
router.post('/', asyncHandler(async (req, res) => {
  const { error, value } = packageSchema.validate(req.body);
  if (error) throw error;

  const result = await db.query(`
    INSERT INTO packages (name, type, speed_upload, speed_download, duration, validity, price, description, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [value.name, value.type, value.speed_upload, value.speed_download,
      value.duration, value.validity, value.price, value.description, value.is_active]);

  // Ensure group policy in FreeRADIUS for this package
  await radius.ensureGroupPolicy(result.rows[0]);

  await cacheDelPattern('packages:*');
  res.status(201).json({ success: true, data: result.rows[0], message: 'Paket berhasil dibuat' });
}));

// PUT /api/packages/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { error, value } = packageSchema.validate(req.body);
  if (error) throw error;

  const result = await db.query(`
    UPDATE packages
    SET name=$1, type=$2, speed_upload=$3, speed_download=$4,
        duration=$5, validity=$6, price=$7, description=$8, is_active=$9
    WHERE id=$10
    RETURNING *
  `, [value.name, value.type, value.speed_upload, value.speed_download,
      value.duration, value.validity, value.price, value.description, value.is_active,
      req.params.id]);

  if (!result.rows[0]) throw createError(404, 'Paket tidak ditemukan');

  // Update group policy in FreeRADIUS
  await radius.ensureGroupPolicy(result.rows[0]);

  await cacheDelPattern('packages:*');
  res.json({ success: true, data: result.rows[0], message: 'Paket berhasil diperbarui' });
}));

// DELETE /api/packages/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(`
    UPDATE packages SET is_active = FALSE WHERE id = $1 RETURNING *
  `, [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Paket tidak ditemukan');
  await cacheDelPattern('packages:*');
  res.json({ success: true, message: 'Paket berhasil dihapus' });
}));

module.exports = router;
