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
  password:     Joi.string().max(100).allow('', null),
  phone:        Joi.string().max(20).allow('', null),
  email:        Joi.string().email().max(100).allow('', null),
  package_id:   Joi.number().integer().allow(null).empty('').default(null),
  package_name: Joi.string().max(100).allow('', null),
  mac_binding:  Joi.boolean().default(false),
  mac_address:  Joi.string().max(20).allow('', null),
  balance:      Joi.number().integer().default(0),
  expiry_date:  Joi.string().isoDate().allow(null),
  is_active:    Joi.boolean().default(true),
  bypass_hotspot: Joi.boolean().default(false),
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

  if (!value.password || value.password.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: ['"password" is required']
    });
  }

  let expiryDate = value.expiry_date;
  let packageId = value.package_id;
  let packageName = value.package_name;

  if (packageId) {
    if (!packageName) {
      const pkgRes = await db.query('SELECT name FROM packages WHERE id = $1', [packageId]);
      if (pkgRes.rows[0]) {
        packageName = pkgRes.rows[0].name;
      }
    }
  } else {
    packageId = null;
    packageName = null;
  }

  if (!expiryDate) {
    if (packageId) {
      const pkgRes = await db.query('SELECT validity FROM packages WHERE id = $1', [packageId]);
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
                         mac_binding, mac_address, balance, expiry_date, is_active, bypass_hotspot)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
  `, [value.name, value.username, value.password, value.phone, value.email,
      packageId, packageName, value.mac_binding,
      value.mac_binding ? (value.mac_address || null) : null,
      value.balance, expiryDate, value.is_active, value.bypass_hotspot]);

  const member = result.rows[0];

  // Sync to FreeRADIUS
  const checkAttrs = {};
  if (expiryDate) {
    const expiration = formatRadiusExpiration(expiryDate);
    if (expiration) checkAttrs['Expiration'] = expiration;
  }

  if (value.package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [value.package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      const quotaSecs = parseDuration(pkg.duration);
      if (quotaSecs > 0) {
        checkAttrs['Max-All-Session'] = quotaSecs;
      }
      
      const replyAttrs = {};
      if (radius.buildRateLimit(pkg)) {
        replyAttrs['Mikrotik-Rate-Limit'] = radius.buildRateLimit(pkg);
      }

      await radius.syncUserToRadius(
        member.username, member.password,
        radius.buildGroupName(pkg),
        replyAttrs,
        checkAttrs
      );

      // Log transaction for member registration
      await db.query(`
        INSERT INTO transactions (type, reference_id, amount, description)
        VALUES ('member', $1, $2, $3)
      `, [member.username, pkg.cost_price, `Pendaftaran member ${member.username} paket ${pkg.name}`]);
    }
  } else {
    await radius.syncUserToRadius(member.username, member.password, 'hotspot-member', {}, checkAttrs);
  }

  await cacheDelPattern('members:*');
  res.status(201).json({ success: true, data: member, message: 'Member berhasil didaftarkan' });
}));

// PUT /api/members/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { error, value } = memberSchema.validate(req.body);
  if (error) throw error;

  let expiryDate = value.expiry_date;

  const oldMemberRes = await db.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  const oldMember = oldMemberRes.rows[0];
  if (!oldMember) throw createError(404, 'Member tidak ditemukan');

  const newPassword = (value.password && value.password.trim() !== '') ? value.password.trim() : oldMember.password;
  const phone = (value.phone !== undefined) ? value.phone : oldMember.phone;
  const email = (value.email !== undefined) ? value.email : oldMember.email;
  const is_active = (value.is_active !== undefined) ? value.is_active : oldMember.is_active;
  const balance = (value.balance !== undefined) ? value.balance : oldMember.balance;
  const mac_binding = (value.mac_binding !== undefined) ? value.mac_binding : oldMember.mac_binding;
  const mac_address = (value.mac_binding !== undefined)
    ? (value.mac_binding ? (value.mac_address || null) : null)
    : oldMember.mac_address;
  const bypass_hotspot = (value.bypass_hotspot !== undefined) ? value.bypass_hotspot : oldMember.bypass_hotspot;

  let packageId = value.package_id;
  let packageName = value.package_name;
  if (packageId) {
    if (!packageName) {
      const pkgRes = await db.query('SELECT name FROM packages WHERE id = $1', [packageId]);
      if (pkgRes.rows[0]) {
        packageName = pkgRes.rows[0].name;
      }
    }
  } else {
    packageId = null;
    packageName = null;
  }

  const result = await db.query(`
    UPDATE members
    SET name=$1, username=$2, password=$3, phone=$4, email=$5,
        package_id=$6, package_name=$7, mac_binding=$8, mac_address=$9,
        balance=$10, expiry_date=COALESCE($11, expiry_date), is_active=$12,
        bypass_hotspot=$13,
        bypass_created=CASE WHEN $13 = FALSE THEN FALSE ELSE bypass_created END
    WHERE id=$14
    RETURNING *
  `, [value.name, value.username, newPassword, phone, email,
      packageId, packageName, mac_binding, mac_address,
      balance, expiryDate, is_active, bypass_hotspot, req.params.id]);

  // If bypass_hotspot was disabled, or username changed, remove the IP binding from MikroTik
  if (oldMember) {
    const usernameChanged = oldMember.username !== value.username;
    const bypassDisabled = oldMember.bypass_hotspot && !value.bypass_hotspot;
    if (bypassDisabled || usernameChanged) {
      const mikrotik = require('../services/mikrotikService');
      try {
        await mikrotik.removeHotspotBypass(oldMember.username);
      } catch (err) {
        console.error(`[MembersAPI] Failed to remove bypass on update for ${oldMember.username}:`, err.message);
      }
    }
  }

  // Re-sync to RADIUS
  const checkAttrs = {};
  if (expiryDate) {
    const expiration = formatRadiusExpiration(expiryDate);
    if (expiration) checkAttrs['Expiration'] = expiration;
  }

  if (packageId) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [packageId]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      const quotaSecs = parseDuration(pkg.duration);
      if (quotaSecs > 0) {
        checkAttrs['Max-All-Session'] = quotaSecs;
      }
      
      const replyAttrs = {};
      if (radius.buildRateLimit(pkg)) {
        replyAttrs['Mikrotik-Rate-Limit'] = radius.buildRateLimit(pkg);
      }

      await radius.syncUserToRadius(
        value.username, newPassword,
        radius.buildGroupName(pkg),
        replyAttrs,
        checkAttrs
      );
    }
  } else {
    await radius.syncUserToRadius(value.username, newPassword, 'hotspot-member', {}, checkAttrs);
  }

  await cacheDelPattern('members:*');
  res.json({ success: true, data: result.rows[0], message: 'Member diperbarui' });
}));

// POST /api/members/:id/extend — Perpanjang paket
router.post('/:id/extend', asyncHandler(async (req, res) => {
  const { days = 30 } = req.body;

  const mRes = await db.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  const m = mRes.rows[0];

  const result = await db.query(`
    UPDATE members
    SET expiry_date = GREATEST(expiry_date, NOW()) + INTERVAL '${parseInt(days)} days',
        is_active = TRUE,
        mac_address = NULL,
        bypass_created = FALSE
    WHERE id = $1
    RETURNING *
  `, [req.params.id]);

  if (!result.rows[0]) throw createError(404, 'Member tidak ditemukan');

  if (m && m.bypass_created) {
    const mikrotik = require('../services/mikrotikService');
    try {
      await mikrotik.removeHotspotBypass(m.username);
    } catch (err) {
      console.error(`[MembersAPI] Failed to remove bypass on extend for ${m.username}:`, err.message);
    }
  }
  await cacheDelPattern('members:*');
  
  // Need to un-reject in RADIUS if they were rejected
  await radius.unisolirUser(result.rows[0].username);
  
  // Re-sync password and package attributes to clear Auth-Type Reject
  const checkAttrs = {};
  if (result.rows[0].expiry_date) {
    const expiration = formatRadiusExpiration(result.rows[0].expiry_date);
    if (expiration) checkAttrs['Expiration'] = expiration;
  }

  if (result.rows[0].package_id) {
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [result.rows[0].package_id]);
    if (pkgRes.rows[0]) {
      const pkg = pkgRes.rows[0];
      const quotaSecs = parseDuration(pkg.duration);
      if (quotaSecs > 0) {
        checkAttrs['Max-All-Session'] = quotaSecs;
      }
      
      const replyAttrs = {};
      if (radius.buildRateLimit(pkg)) {
        replyAttrs['Mikrotik-Rate-Limit'] = radius.buildRateLimit(pkg);
      }

      await radius.syncUserToRadius(
        result.rows[0].username, 
        result.rows[0].password,
        radius.buildGroupName(pkg),
        replyAttrs,
        checkAttrs
      );

      // Log transaction for member extension
      await db.query(`
        INSERT INTO transactions (type, reference_id, amount, description)
        VALUES ('member', $1, $2, $3)
      `, [result.rows[0].username, pkg.cost_price, `Perpanjangan member ${result.rows[0].username} paket ${pkg.name} (${days} hari)`]);
    }
  } else {
    await radius.syncUserToRadius(result.rows[0].username, result.rows[0].password, 'hotspot-member', {}, checkAttrs);
  }
  
  res.json({ success: true, data: result.rows[0], message: `Paket diperpanjang ${days} hari` });
}));


// DELETE /api/members/bulk
router.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw createError(400, 'Tidak ada member yang dipilih');

  // get usernames to remove from radius
  const mRes = await db.query('SELECT username, bypass_created FROM members WHERE id = ANY($1::int[])', [ids]);
  
  await db.query('DELETE FROM members WHERE id = ANY($1::int[])', [ids]);
  
  // Remove from radius and remove MikroTik bypass if created
  const mikrotik = require('../services/mikrotikService');
  for (const row of mRes.rows) {
    await radius.removeUserFromRadius(row.username);
    if (row.bypass_created) {
      try {
        await mikrotik.removeHotspotBypass(row.username);
      } catch (err) {
        console.error(`[MembersAPI] Failed to remove bulk bypass for ${row.username}:`, err.message);
      }
    }
  }
  
  await cacheDelPattern('members:*');
  res.json({ success: true, message: `${mRes.rows.length} member berhasil dihapus` });
}));

// DELETE /api/members/:id

router.delete('/:id', asyncHandler(async (req, res) => {
  const mRes = await db.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!mRes.rows[0]) throw createError(404, 'Member tidak ditemukan');
  const m = mRes.rows[0];

  await db.query('DELETE FROM members WHERE id = $1', [req.params.id]);
  await radius.removeUserFromRadius(m.username);
  
  if (m.bypass_created) {
    const mikrotik = require('../services/mikrotikService');
    try {
      await mikrotik.removeHotspotBypass(m.username);
    } catch (err) {
      console.error(`[MembersAPI] Failed to remove bypass on delete for ${m.username}:`, err.message);
    }
  }

  await cacheDelPattern('members:*');
  res.json({ success: true, message: `Member "${m.name}" dihapus` });
}));

module.exports = router;
