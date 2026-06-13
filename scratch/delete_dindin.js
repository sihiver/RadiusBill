const { query } = require('../backend/src/db/pool');
async function run() {
  await query("DELETE FROM members WHERE username = 'dindin'");
  console.log('Member dindin deleted');
  process.exit(0);
}
run();
