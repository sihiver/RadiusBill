// ─── Vouchers Routes ─────────────────────────────────────────────────────────
// Handles ACTIVE vouchers (Unused/Active) from `vouchers` table
// Expired vouchers are in `voucher_logs` table — see voucherLogs.js
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const db      = require('../db/pool');
const { cacheAside, cacheDel, cacheDelPattern, TTL } = require('../services/cacheService');
const radius  = require('../services/radiusService');
const { runExpireVouchers } = require('../jobs/expireVouchers');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// Util: generate random code characters (no ambiguous chars)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(length) {
  let result = '';
  for (let i = 0; i < length; i++) result += CHARS[Math.floor(Math.random() * CHARS.length)];
  return result;
}

// ── GET /api/vouchers — List active vouchers ──────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50, q: search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];

  if (status && status !== 'All') {
    conditions.push(`v.status = $${params.length + 1}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(v.code ILIKE $${params.length + 1} OR v.package_name ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }
  if (req.user && req.user.role === 'reseller') {
    conditions.push(`v.created_by = $${params.length + 1}`);
    params.push(req.user.username);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [dataRes, countRes] = await Promise.all([
    db.query(`
      SELECT v.*, p.speed_upload, p.speed_download, p.duration, p.validity,
             (SELECT acctstarttime FROM radacct WHERE username = v.code AND acctstoptime IS NULL ORDER BY acctstarttime DESC LIMIT 1) as session_start,
             (SELECT acctsessiontime FROM radacct WHERE username = v.code AND acctstoptime IS NULL ORDER BY acctstarttime DESC LIMIT 1) as current_session_time
      FROM vouchers v
      LEFT JOIN packages p ON p.id = v.package_id
      ${where}
      ORDER BY v.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), offset]),
    db.query(`SELECT COUNT(*) FROM vouchers v ${where}`, params),
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

// ── GET /api/vouchers/stats ───────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const data = await cacheAside('vouchers:stats', async () => {
    const res = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Active')  AS active_count,
        COUNT(*) FILTER (WHERE status = 'Unused')  AS unused_count,
        (SELECT COUNT(*) FROM voucher_logs ${req.user.role === 'reseller' ? `WHERE created_by = '${req.user.username}'` : ''}) AS expired_count
      FROM vouchers
      ${req.user.role === 'reseller' ? `WHERE created_by = '${req.user.username}'` : ''}
    `);
    return res.rows[0];
  }, TTL.STATS);
  res.json({ success: true, data });
}));

// ── GET /api/vouchers/sessions/:code ──────────────────────────────────────────
router.get('/sessions/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const result = await db.query(`
    SELECT 
      radacctid,
      acctstarttime AS started_at,
      acctstoptime AS ended_at,
      acctsessiontime AS duration_secs,
      (acctinputoctets + acctoutputoctets) AS used_bytes,
      framedipaddress::text AS ip_address,
      callingstationid AS mac_address
    FROM radacct
    WHERE username = $1
    ORDER BY acctstarttime DESC
    LIMIT 100
  `, [code]);
  res.json({ success: true, data: result.rows });
}));

// ── GET /api/vouchers/:id ─────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT v.*, p.speed_upload, p.speed_download, p.duration, p.validity
    FROM vouchers v
    LEFT JOIN packages p ON p.id = v.package_id
    WHERE v.id = $1
  `, [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Voucher tidak ditemukan');
  res.json({ success: true, data: result.rows[0] });
}));

// ── POST /api/vouchers/generate — Generate batch vouchers ────────────────────
router.post('/generate', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    package_id:   Joi.number().integer().required(),
    quantity:     Joi.number().integer().min(1).max(500).required(),
    prefix:       Joi.string().max(10).default('RW-'),
    code_length:  Joi.number().integer().min(4).max(12).default(6),
    format:       Joi.string().valid('same', 'up').default('same'),
    mac_binding:  Joi.boolean().default(false),
  });

  const { error, value } = schema.validate(req.body);
  if (error) throw error;

  // Get package
  const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1 AND is_active = TRUE', [value.package_id]);
  if (!pkgRes.rows[0]) throw createError(404, 'Paket tidak ditemukan');
  const pkg = pkgRes.rows[0];

  // Calculate expires_at from validity string (e.g. "30 Hari" → +30 days)
  function parseValidity(validity) {
    const match = validity.match(/(\d+)\s*(Hari|Jam|Minggu|Bulan)/i);
    if (!match) return null;
    const [, num, unit] = match;
    const n = parseInt(num);
    const now = new Date();
    if (/jam/i.test(unit))    return new Date(now.getTime() + n * 3600 * 1000);
    if (/minggu/i.test(unit)) return new Date(now.getTime() + n * 7 * 86400 * 1000);
    if (/bulan/i.test(unit))  return new Date(now.getTime() + n * 30 * 86400 * 1000);
    return new Date(now.getTime() + n * 86400 * 1000); // Hari
  }

  // Calculate quota_seconds from duration string (e.g. "12h" -> 43200)
  function parseDuration(duration) {
    if (!duration || duration.toLowerCase() === 'unlimited') return 0;
    
    let totalSeconds = 0;
    const regex = /(\d+)\s*([wdhms])/gi;
    let match;
    let matchedMikrotik = false;
    
    while ((match = regex.exec(duration)) !== null) {
      matchedMikrotik = true;
      const val = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'w') totalSeconds += val * 7 * 86400;
      else if (unit === 'd') totalSeconds += val * 86400;
      else if (unit === 'h') totalSeconds += val * 3600;
      else if (unit === 'm') totalSeconds += val * 60;
      else if (unit === 's') totalSeconds += val;
    }
    
    if (matchedMikrotik) return totalSeconds;
    
    // Fallback to old format
    const oldMatch = duration.match(/(\d+)\s*(Hari|Jam|Menit)/i);
    if (!oldMatch) return 0;
    const [, num, unit] = oldMatch;
    const n = parseInt(num);
    if (/menit/i.test(unit)) return n * 60;
    if (/jam/i.test(unit))   return n * 3600;
    if (/hari/i.test(unit))  return n * 86400;
    
    return 0;
  }

  const client = await db.getClient();
  const generated = [];

  try {
    await client.query('BEGIN');

    if (req.user && req.user.role === 'reseller') {
      const totalCost = pkg.price * value.quantity;
      const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
      if (!userRes.rows[0]) throw createError(404, 'User tidak valid');
      const balance = Number(userRes.rows[0].balance);
      if (balance < totalCost) {
        throw createError(400, `Saldo tidak cukup. Total: Rp ${totalCost.toLocaleString('id-ID')}, Saldo Anda: Rp ${balance.toLocaleString('id-ID')}`);
      }
      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalCost, req.user.id]);
    }

    const quotaSecs = parseDuration(pkg.duration);

    for (let i = 0; i < value.quantity; i++) {
      const code     = value.prefix + randomCode(value.code_length);
      const password = value.format === 'same' ? code : randomCode(6);
      const expiresAt = null;

      const vRes = await client.query(`
        INSERT INTO vouchers (code, password, package_id, package_name, price, status, mac_binding, expires_at, quota_seconds, created_by)
        VALUES ($1, $2, $3, $4, $5, 'Unused', $6, $7, $8, $9)
        RETURNING *
      `, [code, password, pkg.id, pkg.name, pkg.price, value.mac_binding, expiresAt, quotaSecs, req.user ? req.user.username : 'admin']);

      generated.push(vRes.rows[0]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Sync all generated vouchers to FreeRADIUS radcheck
  const groupName  = radius.buildGroupName(pkg);
  const rateLimit  = radius.buildRateLimit(pkg);
  const quotaSecs  = parseDuration(pkg.duration);
  
  for (const v of generated) {
    const replyAttrs = {};
    if (rateLimit) {
      replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
    }
    if (quotaSecs > 0) {
      replyAttrs['Session-Timeout'] = quotaSecs;
    }
    await radius.syncUserToRadius(v.code, v.password, groupName, replyAttrs);
  }

  await cacheDelPattern('vouchers:*');
  await cacheDelPattern('stats:*');

  res.status(201).json({
    success: true,
    data: generated,
    message: `${generated.length} voucher berhasil digenerate`,
  });
}));

// ── PUT /api/vouchers/:id — Update voucher (MAC, status) ─────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    mac_address: Joi.string().max(20).allow('', null),
    status:      Joi.string().valid('Unused', 'Active'),
    ip_address:  Joi.string().max(20).allow('', null),
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw error;

  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) { fields.push(`${k} = $${params.length + 1}`); params.push(v); }
  }
  if (!fields.length) throw createError(400, 'Tidak ada data yang diupdate');

  params.push(req.params.id);
  const result = await db.query(
    `UPDATE vouchers SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!result.rows[0]) throw createError(404, 'Voucher tidak ditemukan');

  await cacheDelPattern('vouchers:*');
  res.json({ success: true, data: result.rows[0], message: 'Voucher diperbarui' });
}));

// ── DELETE /api/vouchers/bulk — Bulk delete ───────────────────────────────────
router.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw createError(400, 'IDs harus berupa array');

  const vRes = await db.query('SELECT code FROM vouchers WHERE id = ANY($1::int[])', [ids]);
  await db.query('DELETE FROM vouchers WHERE id = ANY($1::int[])', [ids]);

  for (const v of vRes.rows) await radius.removeUserFromRadius(v.code);

  await cacheDelPattern('vouchers:*');
  await cacheDelPattern('stats:*');
  res.json({ success: true, message: `${vRes.rows.length} voucher dihapus` });
}));

// ── DELETE /api/vouchers/:id ─────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const vRes = await db.query('SELECT * FROM vouchers WHERE id = $1', [req.params.id]);
  if (!vRes.rows[0]) throw createError(404, 'Voucher tidak ditemukan');

  await db.query('DELETE FROM vouchers WHERE id = $1', [req.params.id]);
  await radius.removeUserFromRadius(vRes.rows[0].code);
  await cacheDelPattern('vouchers:*');
  await cacheDelPattern('stats:*');
  res.json({ success: true, message: `Voucher ${vRes.rows[0].code} dihapus` });
}));

// ── POST /api/vouchers/:id/disconnect — Force disconnect / kick ───────────────
router.post('/:id/disconnect', asyncHandler(async (req, res) => {
  const vRes = await db.query('SELECT * FROM vouchers WHERE id = $1', [req.params.id]);
  if (!vRes.rows[0]) throw createError(404, 'Voucher tidak ditemukan');
  const v = vRes.rows[0];

  // Send physical disconnect command to NAS (Mikrotik) if it's active
  if (v.status === 'Active') {
    const sessRes = await db.query(`
      SELECT nasipaddress::text, acctsessionid, framedipaddress::text AS framed_ip
      FROM radacct
      WHERE username = $1 AND acctstoptime IS NULL
      ORDER BY acctstarttime DESC
      LIMIT 1
    `, [v.code]);
    if (sessRes.rows[0]) {
      const { nasipaddress, acctsessionid, framed_ip } = sessRes.rows[0];
      if (nasipaddress) {
        await radius.sendDisconnectRequest(v.code, nasipaddress, acctsessionid, framed_ip);
      }
    }
  }

  // Move to voucher_logs with reason 'admin_kick'
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO voucher_logs (
        original_id, code, password, package_id, package_name,
        price, mac_address, ip_address, activated_at, expired_at,
        used_bytes, session_id, expire_reason, created_at, moved_at, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,'admin_kick',$12,NOW(),$13)
    `, [v.id, v.code, v.password, v.package_id, v.package_name,
        v.price, v.mac_address, v.ip_address, v.activated_at,
        v.used_bytes, v.session_id, v.created_at, v.created_by]);

    await client.query('DELETE FROM vouchers WHERE id = $1', [v.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Remove from RADIUS
  await radius.removeUserFromRadius(v.code);
  await cacheDelPattern('vouchers:*');

  res.json({ success: true, message: `Sesi voucher ${v.code} diputus` });
}));

// ── POST /api/vouchers/expire-now — Manual trigger ───────────────────────────
router.post('/expire-now', asyncHandler(async (req, res) => {
  const count = await runExpireVouchers();
  res.json({ success: true, message: `${count} voucher dipindahkan ke log` });
}));

module.exports = router;
