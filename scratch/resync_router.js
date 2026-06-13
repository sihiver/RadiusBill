const { query } = require('../backend/src/db/pool');
const radius = require('../backend/src/services/radiusService');

async function fix() {
  await radius.removeUserFromRadius('dindin');
  
  const rtrRes = await query('SELECT r.*, p.speed_upload, p.speed_download, p.duration, p.name, p.type FROM routers r LEFT JOIN packages p ON p.id = r.package_id WHERE r.pppoe_user = $1', ['dindin']);
  if (rtrRes.rows[0]) {
    const rtr = rtrRes.rows[0];
    const replyAttrs = { 'Mikrotik-Rate-Limit': radius.buildRateLimit(rtr) };
    if (rtr.router_ip) {
      replyAttrs['Framed-IP-Address'] = rtr.router_ip;
    }
    await radius.syncUserToRadius(
      rtr.pppoe_user, rtr.pppoe_pass,
      radius.buildGroupName(rtr),
      replyAttrs
    );
    console.log('Router re-synced successfully with IP');
  } else {
    console.log('Router not found');
  }
  process.exit(0);
}
fix();
