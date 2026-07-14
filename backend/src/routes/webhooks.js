const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const radius = require('../services/radiusService');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/webhooks/payment/mock
// This is a mock webhook that simulates a successful payment from a payment gateway.
router.post('/payment/mock', asyncHandler(async (req, res) => {
  const { invoice_number } = req.body;

  if (!invoice_number) {
    return res.status(400).json({ success: false, message: 'invoice_number required' });
  }

  const invRes = await db.query('SELECT * FROM invoices WHERE invoice_number = $1', [invoice_number]);
  const invoice = invRes.rows[0];

  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Invoice not found' });
  }

  if (invoice.status === 'PAID') {
    return res.json({ success: true, message: 'Invoice already paid' });
  }

  // Begin transaction
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Update Invoice Status
    await client.query(`
      UPDATE invoices 
      SET status = 'PAID', paid_at = NOW() 
      WHERE id = $1
    `, [invoice.id]);

    // 2. Add to transactions table for reporting
    await client.query(`
      INSERT INTO transactions (type, reference_id, amount, description)
      VALUES ($1, $2, $3, $4)
    `, [invoice.user_type, invoice.username, invoice.amount, `Pembayaran Invoice ${invoice.invoice_number} (Via Client Portal)`]);

    // 3. Extend user expiry date and remove isolir
    if (invoice.user_type === 'member') {
      const mRes = await client.query('SELECT package_id FROM members WHERE username = $1', [invoice.username]);
      if (mRes.rows[0]) {
        await client.query(`
          UPDATE members
          SET expiry_date = GREATEST(expiry_date, NOW()) + INTERVAL '30 days',
              is_active = TRUE,
              mac_address = CASE WHEN bypass_hotspot = TRUE THEN mac_address ELSE NULL END
          WHERE username = $1
        `, [invoice.username]);
        
        // Remove from isolir (radius unreject)
        await radius.unisolirUser(invoice.username);
        
        // Re-sync radius
        const pkgRes = await client.query('SELECT * FROM packages WHERE id = $1', [mRes.rows[0].package_id]);
        if (pkgRes.rows[0]) {
          const pkg = pkgRes.rows[0];
          await radius.syncUserToRadius(
            invoice.username,
            null, // Assume password doesn't need re-sync, or we can fetch it if needed. For now, unisolir removes the reject.
            radius.buildGroupName(pkg),
            radius.buildRateLimit(pkg) ? { 'Mikrotik-Rate-Limit': radius.buildRateLimit(pkg) } : {}
          );
        }
      }
    } else if (invoice.user_type === 'pppoe') {
      const rRes = await client.query('SELECT package_id FROM routers WHERE pppoe_user = $1', [invoice.username]);
      if (rRes.rows[0]) {
        await client.query(`
          UPDATE routers
          SET expiry_date = GREATEST(COALESCE(expiry_date, NOW()), NOW()) + INTERVAL '30 days',
              status = 'Online',
              isolir = FALSE,
              isolir_reason = NULL,
              isolir_since = NULL
          WHERE pppoe_user = $1
        `, [invoice.username]);

        await radius.unisolirUser(invoice.username);

        // Disconnect them so Mikrotik reconnects and drops from Isolir profile
        const mikrotik = require('../services/mikrotikService');
        try {
          await mikrotik.disconnectPPPoEUser(invoice.username);
        } catch (e) {
          console.error('[Webhook] Failed to disconnect PPPoE user:', e.message);
        }

        const pkgRes = await client.query('SELECT * FROM packages WHERE id = $1', [rRes.rows[0].package_id]);
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
          await radius.syncUserToRadius(
            invoice.username,
            null,
            radius.buildGroupName(pkg),
            replyAttrs
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Payment successfully processed' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
