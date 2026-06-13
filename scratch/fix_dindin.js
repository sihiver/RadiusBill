const { query } = require('../backend/src/db/pool');
async function run() {
  await query("DELETE FROM radcheck WHERE username = 'dindin' AND attribute = 'Auth-Type'");
  console.log('Removed Auth-Type Reject');
  process.exit(0);
}
run();
