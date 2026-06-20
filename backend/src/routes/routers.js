// ─── Routers (PPPoE) Routes ───────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const db      = require('../db/pool');
const { cacheDelPattern } = require('../services/cacheService');
const radius  = require('../services/radiusService');
const mikrotik = require('../services/mikrotikService');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const routerSchema = Joi.object({
  customer_name: Joi.string().max(100).required(),
  pppoe_user:    Joi.string().max(50).required(),
  pppoe_pass:    Joi.string().max(100).required(),
  router_ip:     Joi.string().ip({ version: ['ipv4'] }).allow('', null),
  package_id:    Joi.number().integer().allow(null),
  package_name:  Joi.string().max(100).allow('', null),
  status:        Joi.string().valid('Online', 'Offline', 'Isolated').default('Online'),
  isolir:        Joi.boolean().default(false),
  isolir_reason: Joi.string().max(200).allow('', null),
  expiry_date:   Joi.date().iso().allow('', null),
});

// Parse duration string into seconds (e.g., "12h" -> 43200)
function parseDuration(duration) {
  if (!duration || duration.toLowerCase() === 'unlimited') return 0;
  
  let totalSeconds = 0;
  const regex = /(\d+)\s*([wdhms])(?!\w)/gi;
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
  
  const oldMatch = duration.match(/(\d+)\s*(Hari|Jam|Minggu|Bulan)/i);
  if (!oldMatch) return 0;
  const [, num, unit] = oldMatch;
  const n = parseInt(num);
  if (/jam/i.test(unit))    return n * 3600;
  if (/minggu/i.test(unit)) return n * 7 * 86400;
  if (/bulan/i.test(unit))  return n * 30 * 86400;
  return n * 86400; // Hari
}

// Convert ISO date string to FreeRADIUS Expiration format (DD MMM YYYY HH:mm:ss)
function formatRadiusExpiration(dateStr) {
  if (!dateStr) return null;
  const dObj = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = dObj.getDate().toString().padStart(2, '0');
  const m = months[dObj.getMonth()];
  const y = dObj.getFullYear();
  const h = dObj.getHours().toString().padStart(2, '0');
  const min = dObj.getMinutes().toString().padStart(2, '0');
  const s = dObj.getSeconds().toString().padStart(2, '0');
  return `${d} ${m} ${y} ${h}:${min}:${s}`;
}

// GET /api/routers
router.get('/', asyncHandler(async (req, res) => {
  const { q: search, status } = req.query;
  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push(`(r.customer_name ILIKE $${params.length + 1} OR r.pppoe_user ILIKE $${params.length + 1} OR CAST(r.router_ip AS TEXT) ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }
  if (status) {
    conditions.push(`r.status = $${params.length + 1}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(`
    SELECT r.*, 
           COALESCE(r.router_ip::text, (
             SELECT framedipaddress::text 
             FROM radacct 
             WHERE username = r.pppoe_user 
               AND acctstoptime IS NULL 
             ORDER BY acctstarttime DESC LIMIT 1
           )) as active_ip,
           p.speed_upload, p.speed_download, p.duration
    FROM routers r
    LEFT JOIN packages p ON p.id = r.package_id
    ${where}
    ORDER BY r.created_at DESC
  `, params);

  res.json({ success: true, data: result.rows });
}));

// GET /api/routers/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT r.*, 
           COALESCE(r.router_ip::text, (
             SELECT framedipaddress::text 
             FROM radacct 
             WHERE username = r.pppoe_user 
               AND acctstoptime IS NULL 
             ORDER BY acctstarttime DESC LIMIT 1
           )) as active_ip,
           p.speed_upload, p.speed_download
    FROM routers r
    LEFT JOIN packages p ON p.id = r.package_id
    WHERE r.id = $1
  `, [req.params.id]);
  if (!result.rows[0]) throw createError(404, 'Router tidak ditemukan');
  res.json({ success: true, data: result.rows[0] });
}));

// GET /api/routers/traffic
router.get('/traffic', asyncHandler(async (req, res) => {
  const usersStr = req.query.users;
  if (!usersStr) {
    return res.json({ success: true, data: {} });
  }

  const pppoeUsers = usersStr.split(',');
  const { getTrafficForPPPoE } = require('../services/mikrotikService');
  
  const trafficData = await getTrafficForPPPoE(pppoeUsers);
  res.json({ success: true, data: trafficData });
}));

// POST /api/routers
router.post('/', asyncHandler(async (req, res) => {
  const { error, value } = routerSchema.validate(req.body);
  if (error) throw error;

  // Check uniqueness across vouchers and members
  const checkConflict = await db.query(`
    SELECT 1 FROM vouchers WHERE code = $1
    UNION
    SELECT 1 FROM members WHERE username = $1
  `, [value.pppoe_user]);
  
  if (checkConflict.rows.length > 0) {
    throw createError(400, 'Username PPPoE ini sudah digunakan oleh Member Hotspot atau Voucher. Gunakan username lain (misal: pppoe_' + value.pppoe_user + ').');
  }

  // Calculate Expiry Date and Prorate
  let newExpiryDate = null;
  let transactionAmount = 0;
  let transactionDesc = '';
  let pkg = null;

  if (value.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [value.package_id]);
    if (pkgRes.rows[0]) {
      pkg = pkgRes.rows[0];
      if (pkg.billing_type === 'fixed_date' && pkg.fixed_date) {
        const { calculateProrate } = require('../utils/billingUtils');
        const prorateInfo = calculateProrate(pkg.fixed_date, pkg.price);
        newExpiryDate = prorateInfo.nextExpiryDate;
        transactionAmount = prorateInfo.proratePrice;
        transactionDesc = `Pendaftaran router PPPoE ${value.customer_name} paket ${pkg.name} (Prorata ${prorateInfo.prorateDays} hari)`;
      } else {
        const { calculateExpiry } = require('../utils/billingUtils');
        newExpiryDate = calculateExpiry(pkg.validity);
        transactionAmount = pkg.price; // Use price instead of cost_price for revenue
        transactionDesc = `Pendaftaran router PPPoE ${value.customer_name} paket ${pkg.name}`;
      }
    }
  }

  const result = await db.query(`
    INSERT INTO routers (customer_name, pppoe_user, pppoe_pass, router_ip, package_id, package_name, status, isolir, expiry_date)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9)
    RETURNING *
  `, [value.customer_name, value.pppoe_user, value.pppoe_pass, value.router_ip,
      value.package_id, value.package_name, value.status, value.isolir, newExpiryDate]);

  const rtr = result.rows[0];

  // Sync to FreeRADIUS
  if (pkg) {
    const replyAttrs = {};
    let speedType = 'fix';
    if (pkg.description && pkg.description.includes('speedType=')) {
      const match = pkg.description.match(/speedType=([^;]+)/);
      if (match) speedType = match[1];
    }
    if (speedType === 'statik' || speedType === 'dinamis') {
      replyAttrs['Mikrotik-Group'] = pkg.name;
    }
    const rateLimit = radius.buildRateLimit(pkg);
    if (rateLimit) {
      replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
    }
    const checkAttrs = {};
    if (newExpiryDate) {
      const expiration = formatRadiusExpiration(newExpiryDate);
      if (expiration) checkAttrs['Expiration'] = expiration;
    }
    
    const quotaSecs = parseDuration(pkg.duration);
    if (quotaSecs > 0) {
      checkAttrs['Max-All-Session'] = quotaSecs;
    }

    if (rtr.router_ip) {
      replyAttrs['Framed-IP-Address'] = rtr.router_ip;
    }
    await radius.syncUserToRadius(
      rtr.pppoe_user, rtr.pppoe_pass,
      radius.buildGroupName(pkg),
      replyAttrs,
      checkAttrs
    );

    // Log transaction for router registration
    if (transactionAmount > 0) {
      await db.query(`
        INSERT INTO transactions (type, reference_id, amount, description)
        VALUES ('pppoe', $1, $2, $3)
      `, [rtr.pppoe_user, transactionAmount, transactionDesc]);
    }
  }

  // Apply isolir if needed
  if (value.isolir || value.status === 'Isolated') {
    await radius.isolirUser(rtr.pppoe_user);
  }

  await cacheDelPattern('routers:*');
  res.status(201).json({ success: true, data: rtr, message: 'Router PPPoE berhasil didaftarkan' });
}));

// PUT /api/routers/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { error, value } = routerSchema.validate(req.body);
  if (error) throw error;

  const oldRes = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
  if (!oldRes.rows[0]) throw createError(404, 'Router tidak ditemukan');
  const old = oldRes.rows[0];

  // Check uniqueness across vouchers and members if username changed
  if (old.pppoe_user !== value.pppoe_user) {
    const checkConflict = await db.query(`
      SELECT 1 FROM vouchers WHERE code = $1
      UNION
      SELECT 1 FROM members WHERE username = $1
    `, [value.pppoe_user]);
    
    if (checkConflict.rows.length > 0) {
      throw createError(400, 'Username PPPoE ini sudah digunakan oleh Member Hotspot atau Voucher. Gunakan username lain (misal: pppoe_' + value.pppoe_user + ').');
    }
  }

  let newExpiryDate = old.expiry_date;
  if (value.expiry_date !== undefined) {
    newExpiryDate = value.expiry_date ? new Date(value.expiry_date) : null;
  } else if (value.package_id && value.package_id !== old.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [value.package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      if (pkg.billing_type === 'fixed_date' && pkg.fixed_date) {
        const { calculateProrate } = require('../utils/billingUtils');
        newExpiryDate = calculateProrate(pkg.fixed_date, pkg.price).nextExpiryDate;
      } else {
        const { calculateExpiry } = require('../utils/billingUtils');
        newExpiryDate = calculateExpiry(pkg.validity);
      }
    }
  }

  const result = await db.query(`
    UPDATE routers
    SET customer_name=$1, pppoe_user=$2, pppoe_pass=$3, router_ip=$4,
        package_id=$5, package_name=$6, status=$7, isolir=$8, expiry_date=$9
    WHERE id=$10
    RETURNING *
  `, [value.customer_name, value.pppoe_user, value.pppoe_pass, value.router_ip,
      value.package_id, value.package_name, value.status, value.isolir, newExpiryDate,
      req.params.id]);

  const rtr = result.rows[0];

  // If username changed, remove old RADIUS entry first
  if (old.pppoe_user !== value.pppoe_user) {
    await radius.removeUserFromRadius(old.pppoe_user);
  }

  // Re-sync to RADIUS
  if (value.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [value.package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      const replyAttrs = {};
      let speedType = 'fix';
      if (pkg.description && pkg.description.includes('speedType=')) {
        const match = pkg.description.match(/speedType=([^;]+)/);
        if (match) speedType = match[1];
      }
      if (speedType === 'statik' || speedType === 'dinamis') {
        replyAttrs['Mikrotik-Group'] = pkg.name;
      }
      const rateLimit = radius.buildRateLimit(pkg);
      if (rateLimit) {
        replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
      }
      const checkAttrs = {};
      if (newExpiryDate) {
        const expiration = formatRadiusExpiration(newExpiryDate);
        if (expiration) checkAttrs['Expiration'] = expiration;
      }
      
      const quotaSecs = parseDuration(pkg.duration);
      if (quotaSecs > 0) {
        checkAttrs['Max-All-Session'] = quotaSecs;
      }

      if (rtr.router_ip) {
        replyAttrs['Framed-IP-Address'] = rtr.router_ip;
      }
      await radius.syncUserToRadius(
        rtr.pppoe_user, rtr.pppoe_pass,
        radius.buildGroupName(pkg),
        replyAttrs,
        checkAttrs
      );
      
      // Auto-disconnect if package changed so Mikrotik applies new profile/limit
      if (old.package_id !== value.package_id) {
        await mikrotik.disconnectPPPoEUser(rtr.pppoe_user);
      }
    }
  }

  // Handle isolir change
  if (value.isolir && !old.isolir) {
    await radius.isolirUser(rtr.pppoe_user);
    await db.query(`UPDATE routers SET isolir_since = NOW() WHERE id = $1`, [req.params.id]);
  } else if (!value.isolir && old.isolir) {
    await radius.unisolirUser(rtr.pppoe_user);
    await db.query(`UPDATE routers SET isolir_since = NULL WHERE id = $1`, [req.params.id]);
  }

  await cacheDelPattern('routers:*');
  res.json({ success: true, data: rtr, message: 'Router diperbarui' });
}));

// POST /api/routers/:id/isolir — Aktifkan isolir
router.post('/:id/isolir', asyncHandler(async (req, res) => {
  const { reason = 'Tunggakan tagihan' } = req.body;
  const rtrRes = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
  if (!rtrRes.rows[0]) throw createError(404, 'Router tidak ditemukan');
  const rtr = rtrRes.rows[0];

  await radius.isolirUser(rtr.pppoe_user);
  await mikrotik.disconnectPPPoEUser(rtr.pppoe_user);

  await db.query(`
    UPDATE routers
    SET status = 'Isolated', isolir = TRUE, isolir_reason = $2, isolir_since = NOW()
    WHERE id = $1
  `, [req.params.id, reason]);

  await cacheDelPattern('routers:*');
  res.json({ success: true, message: `Router "${rtr.customer_name}" berhasil diisolir` });
}));

// POST /api/routers/:id/unisolir — Lepas isolir
router.post('/:id/unisolir', asyncHandler(async (req, res) => {
  const rtrRes = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
  if (!rtrRes.rows[0]) throw createError(404, 'Router tidak ditemukan');
  const rtr = rtrRes.rows[0];

  await radius.unisolirUser(rtr.pppoe_user);
  
  // Re-sync rate limit
  if (rtr.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [rtr.package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      const replyAttrs = {};
      let speedType = 'fix';
      if (pkg.description && pkg.description.includes('speedType=')) {
        const match = pkg.description.match(/speedType=([^;]+)/);
        if (match) speedType = match[1];
      }
      if (speedType === 'statik' || speedType === 'dinamis') {
        replyAttrs['Mikrotik-Group'] = pkg.name;
      }
      const rateLimit = radius.buildRateLimit(pkg);
      if (rateLimit) {
        replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
      }
      const checkAttrs = {};
      if (rtr.expiry_date) {
        const expiration = formatRadiusExpiration(rtr.expiry_date);
        if (expiration) checkAttrs['Expiration'] = expiration;
      }
      
      const quotaSecs = parseDuration(pkg.duration);
      if (quotaSecs > 0) {
        checkAttrs['Max-All-Session'] = quotaSecs;
      }

      if (rtr.router_ip) {
        replyAttrs['Framed-IP-Address'] = rtr.router_ip;
      }
      await radius.syncUserToRadius(
        rtr.pppoe_user, rtr.pppoe_pass,
        radius.buildGroupName(pkg),
        replyAttrs,
        checkAttrs
      );
    }
  }

  await mikrotik.disconnectPPPoEUser(rtr.pppoe_user);

  await db.query(`
    UPDATE routers
    SET status = 'Online', isolir = FALSE, isolir_reason = NULL, isolir_since = NULL
    WHERE id = $1
  `, [req.params.id]);

  await cacheDelPattern('routers:*');
  res.json({ success: true, message: `Isolir router "${rtr.customer_name}" dilepas` });
}));

// POST /api/routers/:id/extend — Perpanjang masa aktif
router.post('/:id/extend', asyncHandler(async (req, res) => {
  const { days = 30 } = req.body;

  const rtrRes = await db.query('SELECT r.*, p.billing_type, p.fixed_date, p.price, p.name as pkg_name FROM routers r LEFT JOIN packages p ON p.id = r.package_id WHERE r.id = $1', [req.params.id]);
  if (!rtrRes.rows[0]) throw createError(404, 'Router tidak ditemukan');
  const rtr = rtrRes.rows[0];

  let newExpiryStr = `GREATEST(COALESCE(expiry_date, NOW()), NOW()) + INTERVAL '${parseInt(days)} days'`;
  let transactionAmount = rtr.price || 0;
  let transactionDesc = `Perpanjangan router PPPoE ${rtr.customer_name} paket ${rtr.pkg_name} (${days} hari)`;

  if (rtr.billing_type === 'fixed_date' && rtr.fixed_date) {
    newExpiryStr = `GREATEST(COALESCE(expiry_date, NOW()), NOW()) + INTERVAL '1 month'`;
    transactionDesc = `Perpanjangan bulanan router PPPoE ${rtr.customer_name} paket ${rtr.pkg_name} (Tgl ${rtr.fixed_date})`;
  }

  const result = await db.query(`
    UPDATE routers
    SET expiry_date = ${newExpiryStr},
        status = 'Online',
        isolir = FALSE,
        isolir_reason = NULL,
        isolir_since = NULL
    WHERE id = $1
    RETURNING *
  `, [req.params.id]);

  const updatedRtr = result.rows[0];

  await cacheDelPattern('routers:*');
  
  // Un-isolate in RADIUS
  await radius.unisolirUser(updatedRtr.pppoe_user);
  
  // Re-sync rate limit
  if (updatedRtr.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [updatedRtr.package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      const replyAttrs = {};
      let speedType = 'fix';
      if (pkg.description && pkg.description.includes('speedType=')) {
        const match = pkg.description.match(/speedType=([^;]+)/);
        if (match) speedType = match[1];
      }
      if (speedType === 'statik' || speedType === 'dinamis') {
        replyAttrs['Mikrotik-Group'] = pkg.name;
      }
      const rateLimit = radius.buildRateLimit(pkg);
      if (rateLimit) {
        replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
      }
      const checkAttrs = {};
      if (updatedRtr.expiry_date) {
        const expiration = formatRadiusExpiration(updatedRtr.expiry_date);
        if (expiration) checkAttrs['Expiration'] = expiration;
      }
      
      const quotaSecs = parseDuration(pkg.duration);
      if (quotaSecs > 0) {
        checkAttrs['Max-All-Session'] = quotaSecs;
      }

      if (updatedRtr.router_ip) {
        replyAttrs['Framed-IP-Address'] = updatedRtr.router_ip;
      }
      await radius.syncUserToRadius(
        updatedRtr.pppoe_user, updatedRtr.pppoe_pass,
        radius.buildGroupName(pkg),
        replyAttrs,
        checkAttrs
      );

      // Log transaction for extension
      if (transactionAmount > 0) {
        await db.query(`
          INSERT INTO transactions (type, reference_id, amount, description)
          VALUES ('pppoe', $1, $2, $3)
        `, [updatedRtr.pppoe_user, transactionAmount, transactionDesc]);
      }
    }
  }

  // Also disconnect so they can reconnect without isolir list
  await mikrotik.disconnectPPPoEUser(rtr.pppoe_user);

  res.json({ success: true, data: updatedRtr, message: `Masa aktif diperpanjang ${days} hari` });
}));

// POST /api/routers/:id/pay — Bayar tagihan bulanan
router.post('/:id/pay', asyncHandler(async (req, res) => {
  const rtrRes = await db.query('SELECT r.*, p.cost_price, p.name as pkg_name FROM routers r LEFT JOIN packages p ON p.id = r.package_id WHERE r.id = $1', [req.params.id]);
  if (!rtrRes.rows[0]) throw createError(404, 'Router tidak ditemukan');
  const rtr = rtrRes.rows[0];

  const amount = rtr.cost_price || 0;
  
  await db.query(`
    INSERT INTO transactions (type, reference_id, amount, description)
    VALUES ('pppoe', $1, $2, $3)
  `, [rtr.pppoe_user, amount, `Pembayaran tagihan router PPPoE ${rtr.customer_name} paket ${rtr.pkg_name}`]);

  res.json({ success: true, message: `Pembayaran tagihan router "${rtr.customer_name}" berhasil dicatat` });
}));

// DELETE /api/routers/bulk
router.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw createError(400, 'Tidak ada router yang dipilih');

  // get pppoe_users to remove from radius
  const mRes = await db.query('SELECT pppoe_user FROM routers WHERE id = ANY($1::int[])', [ids]);
  
  await db.query('DELETE FROM routers WHERE id = ANY($1::int[])', [ids]);
  
  // Remove from radius
  for (const row of mRes.rows) {
    await radius.removeUserFromRadius(row.pppoe_user);
  }
  
  await cacheDelPattern('routers:*');
  res.json({ success: true, message: `${mRes.rows.length} router berhasil dihapus` });
}));

// DELETE /api/routers/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const rtrRes = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
  if (!rtrRes.rows[0]) throw createError(404, 'Router tidak ditemukan');

  await db.query('DELETE FROM routers WHERE id = $1', [req.params.id]);
  await radius.removeUserFromRadius(rtrRes.rows[0].pppoe_user);
  await cacheDelPattern('routers:*');
  res.json({ success: true, message: `Router "${rtrRes.rows[0].customer_name}" dihapus` });
}));

module.exports = router;
