// ─── Auto Expire Vouchers — Cron Job ─────────────────────────────────────────
// Runs every 5 minutes.
// Finds vouchers past their expires_at, MOVES them to voucher_logs,
// and removes them from FreeRADIUS radcheck.
// ─────────────────────────────────────────────────────────────────────────────
const cron = require('node-cron');
const { getClient } = require('../db/pool');
const radius = require('../services/radiusService');
const { cacheDelPattern } = require('../services/cacheService');

/**
 * Move expired vouchers from `vouchers` to `voucher_logs`.
 * Returns the number of vouchers moved.
 */
async function runExpireVouchers() {
  const client = await getClient();
  let movedCount = 0;
  try {
    await client.query('BEGIN');

    // 1. Find expired vouchers (Active/Unused with expires_at in the past OR used_seconds + active_session_time >= quota_seconds)
    const expired = await client.query(`
      SELECT v.* FROM vouchers v
      WHERE (
          (v.expires_at IS NOT NULL AND v.expires_at < NOW())
          OR (v.quota_seconds > 0 AND 
              (v.used_seconds + COALESCE((
                SELECT EXTRACT(EPOCH FROM (NOW() - acctstarttime))
                FROM radacct 
                WHERE username = v.code AND acctstoptime IS NULL
                ORDER BY acctstarttime DESC LIMIT 1
              ), 0)) >= v.quota_seconds
          )
        )
        AND v.status IN ('Active', 'Unused')
      FOR UPDATE SKIP LOCKED
    `);

    if (expired.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    // 2. Insert each into voucher_logs
    for (const v of expired.rows) {
      await client.query(`
        INSERT INTO voucher_logs (
          original_id, code, password, package_id, package_name,
          price, mac_address, ip_address, activated_at, expired_at,
          used_bytes, session_id, expire_reason, created_at, moved_at,
          quota_seconds, used_seconds
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, COALESCE($10, NOW()),
          $11, $12, 'auto', $13, NOW(),
          $14, $15
        )
      `, [
        v.id, v.code, v.password, v.package_id, v.package_name,
        v.price, v.mac_address, v.ip_address, v.activated_at, v.expires_at,
        v.used_bytes, v.session_id, v.created_at, v.quota_seconds, v.used_seconds
      ]);
    }

    // 3. Delete from vouchers (MOVE, not copy)
    const ids = expired.rows.map(v => v.id);
    await client.query(`DELETE FROM vouchers WHERE id = ANY($1::int[])`, [ids]);

    await client.query('COMMIT');
    movedCount = expired.rows.length;

    // 4. Remove from FreeRADIUS radcheck & physical disconnect (async, after commit)
    const dbPool = require('../db/pool');
    for (const v of expired.rows) {
      try {
        if (v.status === 'Active') {
          // Find active session
          const sessRes = await dbPool.query(`
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

        // Get dynamic reject message
        const settingsRes = await dbPool.query("SELECT value FROM system_settings WHERE key = 'msg_voucher_expired'");
        const rejectMsg = settingsRes.rows[0]?.value || "Maaf, Voucher Anda telah Habis/Kedaluwarsa.";

        await radius.rejectUserWithReason(v.code, rejectMsg);
      } catch (err) {
        console.error(`[ExpireJob] Failed to disconnect/remove ${v.code}:`, err.message);
      }
    }

    // 5. Invalidate cache
    await cacheDelPattern('vouchers:*');
    await cacheDelPattern('stats:*');

    console.log(`[ExpireJob] Moved ${movedCount} expired voucher(s) to voucher_logs`);
    return movedCount;

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ExpireJob] Error:', err.message);
    return 0;
  } finally {
    client.release();
  }
}

async function runExpireMembers() {
  const client = await require('../db/pool').getClient();
  const radius = require('../services/radiusService');
  const { cacheDelPattern } = require('../services/cacheService');

  try {
    await client.query('BEGIN');

    // Find expired members OR members that are not active,
    // AND who are not already rejected in FreeRADIUS.
    const expiredRes = await client.query(`
      SELECT m.id, m.username, m.name, m.active_session
      FROM members m
      WHERE (m.expiry_date <= NOW() OR m.is_active = FALSE)
      AND NOT EXISTS (
        SELECT 1 FROM radcheck rc 
        WHERE rc.username = m.username 
        AND rc.attribute = 'Auth-Type' 
        AND rc.value = 'Reject'
      )
      FOR UPDATE SKIP LOCKED
    `);

    if (expiredRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return 0;
    }

    let processedCount = 0;

    // Get dynamic reject message
    const dbPool = require('../db/pool');
    const settingsRes = await dbPool.query("SELECT value FROM system_settings WHERE key = 'msg_voucher_expired'");
    const rejectMsg = settingsRes.rows[0]?.value || "Maaf, Voucher Anda telah Habis/Kedaluwarsa.";

    for (const m of expiredRes.rows) {
      try {
        // Disconnect if active session
        if (m.active_session) {
          const sessRes = await dbPool.query(`
            SELECT nasipaddress::text, acctsessionid, framedipaddress::text AS framed_ip
            FROM radacct
            WHERE username = $1 AND acctstoptime IS NULL
            ORDER BY acctstarttime DESC
            LIMIT 1
          `, [m.username]);

          if (sessRes.rows[0] && sessRes.rows[0].nasipaddress) {
            await radius.sendDisconnectRequest(m.username, sessRes.rows[0].nasipaddress, sessRes.rows[0].acctsessionid, sessRes.rows[0].framed_ip);
          }
        }

        // Ensure rejected in FreeRADIUS
        await radius.rejectUserWithReason(m.username, rejectMsg);

        // Removed: We do NOT set is_active = FALSE here because is_active = FALSE means soft-deleted,
        // which makes the member disappear from the list. The member is naturally expired based on expiry_date.

        processedCount++;
      } catch (err) {
        console.error(`[ExpireMembersJob] Failed for member ${m.username}:`, err.message);
      }
    }

    await client.query('COMMIT');
    if (processedCount > 0) {
      await cacheDelPattern('members:*');
      console.log(`[ExpireMembersJob] Processed/Rejected ${processedCount} expired/inactive member(s)`);
    }
    return processedCount;

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ExpireMembersJob] Error:', err.message);
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Start the cron job.
 * Default schedule: every 5 minutes (x/5 x x x x)
 */
function startExpireJob() {
  const schedule = process.env.VOUCHER_EXPIRE_CRON || '*/5 * * * *';
  console.log(`[ExpireJob] Starting cron: "${schedule}"`);

  cron.schedule(schedule, async () => {
    console.log('[ExpireJob] Running voucher and member expiry check...');
    await runExpireVouchers();
    await runExpireMembers();
  });
}

module.exports = { startExpireJob, runExpireVouchers, runExpireMembers };
