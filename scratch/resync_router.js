const { query } = require('../backend/src/db/pool');
const radius = require('../backend/src/services/radiusService');

async function fix() {
  // Clear everything for dindin in freeradius
  await radius.removeUserFromRadius('dindin');
  
  // Re-sync router dindin
  const rtrRes = await query('SELECT r.*, p.speed_upload, p.speed_download, p.duration, p.name, p.type FROM routers r LEFT JOIN packages p ON p.id = r.package_id WHERE r.pppoe_user = $1', ['dindin']);
  if (rtrRes.rows[0]) {
    const rtr = rtrRes.rows[0];
    await radius.syncUserToRadius(
      rtr.pppoe_user, rtr.pppoe_pass,
      radius.buildGroupName(rtr),
      { 'Mikrotik-Rate-Limit': radius.buildRateLimit(rtr) }
    );
    console.log('Router re-synced successfully');
  } else {
    console.log('Router not found');
  }
  process.exit(0);
}
fix();
