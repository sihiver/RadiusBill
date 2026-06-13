// ─── Auto Cleanup Stale Sessions — Cron Job ────────────────────────────────────
// Runs every minute.
// Finds sessions in radacct that have no interim-updates for X minutes
// and forces them closed by setting acctstoptime = acctupdatetime.
// ─────────────────────────────────────────────────────────────────────────────
const cron = require('node-cron');
const { getClient, query } = require('../db/pool');
const { cacheDelPattern } = require('../services/cacheService');

/**
 * Clean up stale sessions in radacct.
 */
async function runCleanupStaleSessions() {
  const client = await getClient();
  try {
    // Get timeout from settings
    const settingRes = await client.query("SELECT value FROM system_settings WHERE key = 'stale_session_timeout_minutes'");
    let timeoutMinutes = 15; // default 15 minutes
    if (settingRes.rows[0] && !isNaN(parseInt(settingRes.rows[0].value))) {
      timeoutMinutes = parseInt(settingRes.rows[0].value);
    }
    
    if (timeoutMinutes <= 0) {
      // Disabled if 0
      return 0;
    }

    await client.query('BEGIN');

    // Find and update stale sessions
    // Stale: acctstoptime is NULL AND last update (acctupdatetime) is older than X minutes
    // If acctupdatetime is NULL, fallback to acctstarttime.
    const res = await client.query(`
      WITH stale AS (
        SELECT radacctid, COALESCE(acctupdatetime, acctstarttime) as last_activity
        FROM radacct
        WHERE acctstoptime IS NULL
          AND COALESCE(acctupdatetime, acctstarttime) < NOW() - INTERVAL '1 minute' * $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE radacct r
      SET acctstoptime = s.last_activity,
          acctterminatecause = 'Lost-Carrier'
      FROM stale s
      WHERE r.radacctid = s.radacctid
      RETURNING r.radacctid, r.username
    `, [timeoutMinutes]);

    await client.query('COMMIT');

    if (res.rowCount > 0) {
      console.log(`[StaleSessionJob] Cleaned up ${res.rowCount} stale session(s) using ${timeoutMinutes}m timeout.`);
      
      // Update member active_session status
      for (const row of res.rows) {
        await query(`
          UPDATE members
          SET active_session = FALSE, updated_at = NOW()
          WHERE username = $1 AND active_session = TRUE
        `, [row.username]);
      }

      // Invalidate cache
      await cacheDelPattern('radius:*');
      await cacheDelPattern('dashboard:*');
      await cacheDelPattern('vouchers:*');
    }

    return res.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[StaleSessionJob] Error:', err.message);
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Start the cron job.
 * Default schedule: every 1 minute
 */
function startStaleSessionJob() {
  console.log(`[StaleSessionJob] Starting cron: "*/1 * * * *"`);
  cron.schedule('*/1 * * * *', async () => {
    await runCleanupStaleSessions();
  });
}

module.exports = { startStaleSessionJob, runCleanupStaleSessions };
