const { query } = require('../backend/src/db/pool');
async function run() {
  const r = await query("SELECT * FROM radreply WHERE username = 'dindin'");
  console.log('radreply:', r.rows);
  process.exit(0);
}
run();
