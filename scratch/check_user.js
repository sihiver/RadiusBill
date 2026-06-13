const { query } = require('../backend/src/db/pool');
async function check() {
  const v = await query("SELECT code, mac_binding, mac_address FROM vouchers WHERE code = 'dindin'");
  const m = await query("SELECT username, mac_binding, mac_address FROM members WHERE username = 'dindin'");
  const r = await query("SELECT pppoe_user, status, isolir FROM routers WHERE pppoe_user = 'dindin'");
  const rc = await query("SELECT * FROM radcheck WHERE username = 'dindin'");
  console.log('Voucher:', v.rows);
  console.log('Member:', m.rows);
  console.log('Router:', r.rows);
  console.log('Radcheck:', rc.rows);
  process.exit(0);
}
check();
