const { RouterOSClient } = require('routeros-client');

async function test() {
  const client = new RouterOSClient({
    host: '192.168.88.1',
    user: 'admin',
    password: '',
    port: 8728
  });

  try {
    const conn = await client.connect();
    
    // Attempt to query all interfaces at once
    // We can just query interface="all" maybe? No, "all" doesn't work for monitor-traffic.
    // What if we get all pppoe interfaces first?
    const pppoeIfaces = await conn.menu('/interface/pppoe-server').getAll();
    const names = pppoeIfaces.map(i => i.name).join(',');
    
    if (names) {
      const traffic = await conn.write('/interface/monitor-traffic', [
        `=interface=${names}`,
        '=once='
      ]);
      console.log('Traffic:', traffic);
    } else {
      console.log('No PPPoE interfaces found');
    }
    
    conn.close();
  } catch (err) {
    console.error(err);
  }
}

test();
