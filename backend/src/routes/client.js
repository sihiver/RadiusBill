const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// ── Public Hotspot Voucher Check: GET /api/client/voucher-check/:code ────────
router.get('/voucher-check/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Kode voucher harus diisi' });
  }

  // 1. Cek data voucher di tabel vouchers
  const vResult = await db.query(`
    SELECT v.id, v.code, v.status, v.created_at, v.first_login_at, v.expired_at,
           p.id as package_id, p.name as package_name, p.duration, p.validity,
           p.speed_upload, p.speed_download, p.price
    FROM vouchers v
    LEFT JOIN packages p ON p.id = v.package_id
    WHERE v.code = $1
    LIMIT 1
  `, [code]);

  if (vResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Kode voucher tidak ditemukan di sistem'
    });
  }

  const voucher = vResult.rows[0];

  // 2. Cek sesi aktif di radacct (sedang login atau tidak)
  const activeSessionRes = await db.query(`
    SELECT acctstarttime, acctsessiontime, framedipaddress::text as ip_address,
           callingstationid as mac_address, (acctinputoctets + acctoutputoctets) as used_bytes
    FROM radacct
    WHERE username = $1 AND acctstoptime IS NULL
    ORDER BY acctstarttime DESC
    LIMIT 1
  `, [code]);

  const isOnline = activeSessionRes.rows.length > 0;
  const currentSession = isOnline ? activeSessionRes.rows[0] : null;

  // 3. Hitung total pemakaian sebelumnya
  const totalStatsRes = await db.query(`
    SELECT COALESCE(SUM(acctsessiontime), 0) as total_used_seconds,
           COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_used_bytes
    FROM radacct
    WHERE username = $1
  `, [code]);

  const totalUsedSeconds = parseInt(totalStatsRes.rows[0].total_used_seconds, 10);
  const totalUsedBytes = parseInt(totalStatsRes.rows[0].total_used_bytes, 10);

  // Sisa durasi (jika package memiliki durasi detik)
  let remainingSeconds = null;
  if (voucher.duration && voucher.duration > 0) {
    remainingSeconds = Math.max(0, voucher.duration - totalUsedSeconds);
  }

  res.json({
    success: true,
    data: {
      code: voucher.code,
      status: voucher.status,
      packageName: voucher.package_name,
      speed: `${voucher.speed_download || 0} Mbps / ${voucher.speed_upload || 0} Mbps`,
      isOnline,
      currentSession,
      totalUsedSeconds,
      totalUsedBytes,
      remainingSeconds,
      firstLoginAt: voucher.first_login_at,
      expiredAt: voucher.expired_at
    }
  });
}));

// GET /api/client/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  // `req.user` comes from jwt token: { id, username, role, userType }
  if (req.user.role !== 'client') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { username, userType } = req.user;
  let userData = null;

  if (userType === 'member') {
    const result = await db.query(`
      SELECT m.*, p.speed_upload, p.speed_download, p.duration, p.price, p.name as pkg_name
      FROM members m
      LEFT JOIN packages p ON p.id = m.package_id
      WHERE m.username = $1
    `, [username]);
    userData = result.rows[0];
  } else if (userType === 'pppoe') {
    const result = await db.query(`
      SELECT r.*, p.speed_upload, p.speed_download, p.duration, p.price, p.name as pkg_name
      FROM routers r
      LEFT JOIN packages p ON p.id = r.package_id
      WHERE r.pppoe_user = $1
    `, [username]);
    userData = result.rows[0];
  }

  if (!userData) {
    return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
  }

  res.json({ success: true, data: userData, userType });
}));

// GET /api/client/invoices
router.get('/invoices', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { username } = req.user;
  const result = await db.query(`
    SELECT * FROM invoices 
    WHERE username = $1 
    ORDER BY created_at DESC
  `, [username]);

  res.json({ success: true, data: result.rows });
}));

// POST /api/client/invoices
router.post('/invoices', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { username, userType } = req.user;
  const { payment_method } = req.body;

  // Find the user's active package and price
  let amount = 0;
  let description = '';
  
  if (userType === 'member') {
    const mRes = await db.query('SELECT m.*, p.price, p.name as pkg_name FROM members m LEFT JOIN packages p ON p.id = m.package_id WHERE m.username = $1', [username]);
    if (!mRes.rows[0]) throw createError(404, 'Member tidak ditemukan');
    amount = mRes.rows[0].price || 0;
    description = `Perpanjangan Member ${username} Paket ${mRes.rows[0].pkg_name}`;
  } else {
    const rRes = await db.query('SELECT r.*, p.price, p.name as pkg_name FROM routers r LEFT JOIN packages p ON p.id = r.package_id WHERE r.pppoe_user = $1', [username]);
    if (!rRes.rows[0]) throw createError(404, 'Router tidak ditemukan');
    amount = rRes.rows[0].price || 0;
    description = `Perpanjangan PPPoE ${username} Paket ${rRes.rows[0].pkg_name}`;
  }

  if (amount <= 0) {
    throw createError(400, 'Harga paket tidak valid atau 0. Hubungi admin.');
  }

  // Check if there is an existing UNPAID invoice
  const existingRes = await db.query(`
    SELECT * FROM invoices 
    WHERE username = $1 AND status = 'UNPAID'
  `, [username]);

  if (existingRes.rows.length > 0) {
    // Return existing UNPAID invoice instead of creating a new one
    return res.json({ success: true, data: existingRes.rows[0], message: 'Gunakan tagihan yang belum lunas ini.' });
  }

  // Generate Invoice Number
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // MOCK PAYMENT GATEWAY LOGIC
  // In a real scenario, you'd call Tripay/Midtrans API here to get `checkout_url` and `payment_ref`
  const mockRef = `MOCK-REF-${Date.now()}`;
  const mockCheckoutUrl = `/client/mock-pay/${invoiceNumber}`;
  
  const d = new Date();
  d.setDate(d.getDate() + 1); // Expires in 24 hours
  const expiredAt = d.toISOString();

  const insertRes = await db.query(`
    INSERT INTO invoices (
      invoice_number, username, user_type, amount, status, 
      payment_method, payment_ref, checkout_url, description, expired_at
    ) VALUES ($1, $2, $3, $4, 'UNPAID', $5, $6, $7, $8, $9)
    RETURNING *
  `, [invoiceNumber, username, userType, amount, payment_method || 'MOCK', mockRef, mockCheckoutUrl, description, expiredAt]);

  res.status(201).json({ success: true, data: insertRes.rows[0] });
}));

module.exports = router;
