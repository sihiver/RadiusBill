const { query } = require('../backend/src/db/pool');
async function run() {
  const r = await query("SELECT * FROM radcheck WHERE username = 'dindin'");
  console.log('radcheck:', r.rows);
  process.exit(0);
}
run();
