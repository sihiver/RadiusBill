// ─── Members Routes ───────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const db      = require('../db/pool');
const { cacheAside, cacheDelPattern, TTL } = require('../services/cacheService');
const radius  = require('../services/radiusService');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const memberSchema = Joi.object({
  name:         Joi.string().max(100).required(),
  username:     Joi.string().max(50).required(),
  password:     Joi.string().max(100).required(),
  phone:        Joi.string().max(20).allow('', null),
  email:        Joi.string().email().max(100).allow('', null),
  package_id:   Joi.number().integer().allow(null),
  package_name: Joi.string().max(100).allow('', null),
  mac_binding:  Joi.boolean().default(false),
  mac_address:  Joi.string().max(20).allow('', null),
  balance:      Joi.number().integer().default(0),
  expiry_date:  Joi.string().isoDate().allow(null),
  is_active:    Joi.boolean().default(true),
});

// GET /api/members
router.get('/', asyncHandler(async (req, res) => {
  const { q: search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = ['m.is_active = TRUE'];
  const params     = [];

  if (search) {
    conditions.push(`(m.name ILIKE $${params.length + 1} OR m.username ILIKE $${params.length + 1} OR m.phone ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [dataRes, countRes] = await Promise.all([
    db.query(`
      SELECT m.*, p.speed_upload, p.speed_download, p.duration
      FROM members m
      LEFT JOIN packages p ON p.id = m.package_id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), offset]),
    db.query(`SELECT COUNT(*) FROM members m ${where}`, params),
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

// GET /api/members/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT m.*, p.speed_upload, p.speed_download, p.duration, p.validity
    FROM members m
    LEFT JOIN packages p ON p.id = m.package_id
    WHERE m.id = $1
  `, [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Member tidak ditemukan');
  res.json({ success: true, data: result.rows[0] });
}));

// GET /api/members/:id/sessions — Riwayat sesi dari radacct
router.get('/:id/sessions', asyncHandler(async (req, res) => {
  const memberRes = await db.query('SELECT username FROM members WHERE id = $1', [req.params.id]);
  if (!memberRes.rows[0]) throw createError(404, 'Member tidak ditemukan');
  const { username } = memberRes.rows[0];

  const sessions = await db.query(`
    SELECT
      radacctid, acctsessionid, framedipaddress AS ip,
      callingstationid AS mac, nasipaddress AS nas_ip,
      acctstarttime AS started_at, acctstoptime AS ended_at,
      acctsessiontime AS duration_secs,
      acctinputoctets + acctoutputoctets AS total_bytes
    FROM radacct
    WHERE username = $1
    ORDER BY acctstarttime DESC
    LIMIT 50
  `, [username]);

  res.json({ success: true, data: sessions.rows });
}));

// POST /api/members
router.post('/', asyncHandler(async (req, res) => {
  const { error, value } = memberSchema.validate(req.body);
  if (error) throw error;

  let expiryDate = value.expiry_date;
  if (!expiryDate) {
    if (value.package_id) {
      const pkgRes = await db.query('SELECT validity FROM packages WHERE id = $1', [value.package_id]);
      if (pkgRes.rows[0] && pkgRes.rows[0].validity) {
        const expRes = await db.query(`SELECT NOW() + parse_mikrotik_time($1) AS exp`, [pkgRes.rows[0].validity]);
        expiryDate = expRes.rows[0].exp;
      }
    }
    if (!expiryDate) {
      const d = new Date(); d.setDate(d.getDate() + 30); expiryDate = d.toISOString();
    }
  }

  const result = await db.query(`
    INSERT INTO members (name, username, password, phone, email, package_id, package_name,
                         mac_binding, mac_address, balance, expiry_date, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *
  `, [value.name, value.username, value.password, value.phone, value.email,
      value.package_id, value.package_name, value.mac_binding,
      value.mac_binding ? (value.mac_address || null) : null,
      value.balance, expiryDate, value.is_active]);

  const member = result.rows[0];

  // Sync to FreeRADIUS
  if (value.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [value.package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      await radius.syncUserToRadius(
        member.username, member.password,
        radius.buildGroupName(pkg),
        { 'Mikrotik-Rate-Limit': radius.buildRateLimit(pkg) }
      );

      // Log transaction for member registration
      await db.query(`
        INSERT INTO transactions (type, reference_id, amount, description)
        VALUES ('member', $1, $2, $3)
      `, [member.username, pkg.price, `Pendaftaran member ${member.username} paket ${pkg.name}`]);
    }
  } else {
    await radius.syncUserToRadius(member.username, member.password, 'hotspot-member');
  }

  await cacheDelPattern('members:*');
  res.status(201).json({ success: true, data: member, message: 'Member berhasil didaftarkan' });
}));

// PUT /api/members/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { error, value } = memberSchema.validate(req.body);
  if (error) throw error;

  let expiryDate = value.expiry_date;

  const result = await db.query(`
    UPDATE members
    SET name=$1, username=$2, password=$3, phone=$4, email=$5,
        package_id=$6, package_name=$7, mac_binding=$8, mac_address=$9,
        balance=$10, expiry_date=COALESCE($11, expiry_date), is_active=$12
    WHERE id=$13
    RETURNING *
  `, [value.name, value.username, value.password, value.phone, value.email,
      value.package_id, value.package_name, value.mac_binding,
      value.mac_binding ? (value.mac_address || null) : null,
      value.balance, expiryDate, value.is_active, req.params.id]);

  if (!result.rows[0]) throw createError(404, 'Member tidak ditemukan');

  // Re-sync to RADIUS
  if (value.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [value.package_id]);
    if (pkgRes.rows[0]) {
      await radius.syncUserToRadius(
        value.username, value.password,
        radius.buildGroupName(pkgRes.rows[0]),
        { 'Mikrotik-Rate-Limit': radius.buildRateLimit(pkgRes.rows[0]) }
      );
    }
  }

  await cacheDelPattern('members:*');
  res.json({ success: true, data: result.rows[0], message: 'Member diperbarui' });
}));

// POST /api/members/:id/extend — Perpanjang paket
router.post('/:id/extend', asyncHandler(async (req, res) => {
  const { days = 30 } = req.body;

  const result = await db.query(`
    UPDATE members
    SET expiry_date = GREATEST(expiry_date, NOW()) + INTERVAL '${parseInt(days)} days',
        is_active = TRUE,
        mac_address = NULL
    WHERE id = $1
    RETURNING *
  `, [req.params.id]);

  if (!result.rows[0]) throw createError(404, 'Member tidak ditemukan');
  await cacheDelPattern('members:*');
  
  // Need to un-reject in RADIUS if they were rejected
  await radius.unisolirUser(result.rows[0].username);
  
  // Re-sync password and package attributes to clear Auth-Type Reject
  if (result.rows[0].package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [result.rows[0].package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      await radius.syncUserToRadius(
        result.rows[0].username, 
        result.rows[0].password,
        radius.buildGroupName(pkg),
        { 'Mikrotik-Rate-Limit': radius.buildRateLimit(pkg) }
      );

      // Log transaction for member extension
      await db.query(`
        INSERT INTO transactions (type, reference_id, amount, description)
        VALUES ('member', $1, $2, $3)
      `, [result.rows[0].username, pkg.price, `Perpanjangan member ${result.rows[0].username} paket ${pkg.name} (${days} hari)`]);
    }
  } else {
    await radius.syncUserToRadius(result.rows[0].username, result.rows[0].password, 'hotspot-member', {});
  }
  
  res.json({ success: true, data: result.rows[0], message: `Paket diperpanjang ${days} hari` });
}));

// DELETE /api/members/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const mRes = await db.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!mRes.rows[0]) throw createError(404, 'Member tidak ditemukan');
  const m = mRes.rows[0];

  await db.query('UPDATE members SET is_active = FALSE WHERE id = $1', [req.params.id]);
  await radius.removeUserFromRadius(m.username);
  await cacheDelPattern('members:*');
  res.json({ success: true, message: `Member "${m.name}" dihapus` });
}));

module.exports = router;
