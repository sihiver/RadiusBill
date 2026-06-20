const db = require('../db/pool');
const mikrotik = require('../services/mikrotikService');

/**
 * Checks database for members who have bypass_hotspot active, a known MAC address,
 * and have not yet been bypassed in MikroTik, and sets their IP bindings.
 */
async function processBypassBindings() {
  try {
    const res = await db.query(`
      SELECT id, username, mac_address 
      FROM members 
      WHERE bypass_hotspot = TRUE 
        AND mac_address IS NOT NULL 
        AND bypass_created = FALSE
    `);

    for (const m of res.rows) {
      console.log(`[BypassJob] Processing bypass for member "${m.username}" with MAC ${m.mac_address}...`);
      const success = await mikrotik.addHotspotBypass(m.mac_address, m.username);
      if (success) {
        await db.query(`
          UPDATE members 
          SET bypass_created = TRUE, updated_at = NOW() 
          WHERE id = $1
        `, [m.id]);
        console.log(`[BypassJob] Successfully marked bypass_created = TRUE for ${m.username}`);
      }
    }
  } catch (err) {
    console.error('[BypassJob] Error processing bindings:', err.message);
  }
}

/**
 * Start the background polling task.
 */
function startBypassJob() {
  console.log('[BypassJob] Starting background hotspot bypass sync (15s interval)...');
  // Initial check
  processBypassBindings();
  
  // Poll every 15 seconds
  setInterval(processBypassBindings, 15000);
}

module.exports = { startBypassJob, processBypassBindings };
