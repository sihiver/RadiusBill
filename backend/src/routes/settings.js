// ─── System Settings Routes ───────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const db      = require('../db/pool');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/settings
router.get('/', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT key, value, description FROM system_settings ORDER BY key');
  // Convert to object
  const settings = {};
  result.rows.forEach(r => { settings[r.key] = r.value; });
  res.json({ success: true, data: settings });
}));

// PUT /api/settings — Batch update settings
router.put('/', asyncHandler(async (req, res) => {
  const updates = req.body; // { key: value, ... }
  const client  = await db.getClient();

  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(updates)) {
      await client.query(`
        INSERT INTO system_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [key, String(value)]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
}));

// POST /api/settings/test-radius — Test FreeRADIUS DB connection
router.post('/test-radius', asyncHandler(async (req, res) => {
  const start = Date.now();
  try {
    await db.query('SELECT COUNT(*) FROM radcheck');
    const ms = Date.now() - start;
    res.json({
      success: true,
      message: `Koneksi FreeRADIUS DB berhasil (${ms}ms)`,
      latency: ms,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `Koneksi gagal: ${err.message}` });
  }
}));

// POST /api/settings/test-mikrotik — Test Mikrotik API connection (basic TCP)
router.post('/test-mikrotik', asyncHandler(async (req, res) => {
  const { host, port = 8728 } = req.body;
  if (!host) return res.status(400).json({ success: false, message: 'Host diperlukan' });

  const net = require('net');
  const start = Date.now();

  const result = await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.connect(parseInt(port), host, () => {
      socket.destroy();
      resolve({ ok: true, ms: Date.now() - start });
    });
    socket.on('error', (e) => resolve({ ok: false, error: e.message }));
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, error: 'Timeout' }); });
  });

  if (result.ok) {
    res.json({ success: true, message: `Koneksi Mikrotik berhasil (${result.ms}ms)`, latency: result.ms });
  } else {
    res.status(502).json({ success: false, message: `Gagal: ${result.error}` });
  }
}));

// POST /api/settings/mikrotik/setup-isolir
router.post('/mikrotik/setup-isolir', asyncHandler(async (req, res) => {
  const { app_ip } = req.body;
  if (!app_ip) return res.status(400).json({ success: false, message: 'IP Aplikasi diperlukan' });
  
  const mikrotik = require('../services/mikrotikService');
  await mikrotik.setupIsolirRules(app_ip);
  
  res.json({ success: true, message: 'Aturan Isolir NAT berhasil dipasang di MikroTik' });
}));

module.exports = router;
