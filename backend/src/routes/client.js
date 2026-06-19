const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { asyncHandler, createError } = require('../middleware/errorHandler');

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
