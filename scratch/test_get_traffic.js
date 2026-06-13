const mikrotikService = require('../backend/src/services/mikrotikService');

async function run() {
  const users = ['dindin'];
  console.log(`Fetching traffic for: ${users}`);
  try {
    const res = await mikrotikService.getTrafficForPPPoE(users);
    console.log('Result:', res);
  } catch(e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

run();
