const { query } = require('../backend/src/db/pool');
async function run() {
  const r = await query("SELECT router_ip FROM routers WHERE pppoe_user = 'dindin'");
  console.log('Router IP:', r.rows[0]);
  process.exit(0);
}
run();
