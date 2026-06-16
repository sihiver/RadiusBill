const db = require('../src/db/pool');
const radius = require('../src/services/radiusService');

async function resync() {
  console.log('Starting resync...');
  
  // 1. Resync all packages to radgroupreply
  const pkgs = await db.query('SELECT * FROM packages');
  for (const pkg of pkgs.rows) {
    await radius.ensureGroupPolicy(pkg);
    console.log(`Synced group policy for package: ${pkg.name}`);
  }

  // 2. Resync all routers
  const routers = await db.query('SELECT * FROM routers');
  for (const r of routers.rows) {
    if (r.package_id) {
      const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [r.package_id]);
      if (pkgRes.rows[0]) {
        const pkg = pkgRes.rows[0];
        const replyAttrs = { 'Mikrotik-Group': pkg.name };
        const rateLimit = radius.buildRateLimit(pkg);
        if (rateLimit) replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
        if (r.router_ip) replyAttrs['Framed-IP-Address'] = r.router_ip;
        
        await radius.syncUserToRadius(
          r.pppoe_user, r.pppoe_pass,
          radius.buildGroupName(pkg),
          replyAttrs
        );
        console.log(`Synced router: ${r.pppoe_user}`);
      }
    }
  }

  // 3. Resync all members
  const members = await db.query('SELECT * FROM members WHERE is_active = TRUE');
  for (const m of members.rows) {
    if (m.package_id) {
      const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [m.package_id]);
      if (pkgRes.rows[0]) {
        const pkg = pkgRes.rows[0];
        await radius.syncUserToRadius(
          m.username, m.password,
          radius.buildGroupName(pkg),
          radius.buildRateLimit(pkg) ? { 'Mikrotik-Rate-Limit': radius.buildRateLimit(pkg) } : {}
        );
        console.log(`Synced member: ${m.username}`);
      }
    }
  }

  // 4. Resync all active vouchers
  const vouchers = await db.query("SELECT * FROM vouchers WHERE status = 'Unused' OR status = 'Active'");
  for (const v of vouchers.rows) {
    if (v.package_id) {
      const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [v.package_id]);
      if (pkgRes.rows[0]) {
        const pkg = pkgRes.rows[0];
        const groupName = radius.buildGroupName(pkg);
        const rateLimit = radius.buildRateLimit(pkg);
        
        const replyAttrs = {};
        if (rateLimit) replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
        if (v.quota_seconds > 0) replyAttrs['Session-Timeout'] = v.quota_seconds;

        await radius.syncUserToRadius(v.code, v.password, groupName, replyAttrs);
        console.log(`Synced voucher: ${v.code}`);
      }
    }
  }

  console.log('Resync complete!');
  process.exit(0);
}

resync().catch(err => {
  console.error(err);
  process.exit(1);
});
