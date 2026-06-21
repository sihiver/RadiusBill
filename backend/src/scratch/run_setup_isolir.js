const db = require('../db/pool');
const { setupIsolirRules } = require('../services/mikrotikService');

async function run() {
  try {
    console.log('Mengambil konfigurasi MikroTik dari database...');
    const result = await db.query("SELECT key, value FROM system_settings WHERE key LIKE 'mikrotik_%'");
    
    const config = {};
    result.rows.forEach(r => {
      config[r.key] = r.value;
    });

    if (!config.mikrotik_host || !config.mikrotik_user) {
      throw new Error('Konfigurasi MikroTik tidak lengkap di database.');
    }

    console.log(`Menghubungkan ke MikroTik di ${config.mikrotik_host}:${config.mikrotik_port || 8728}...`);
    
    // Setup isolir to use IP 167.71.200.190 on port 3001
    const success = await setupIsolirRules('167.71.200.190:3001');
    if (success) {
      console.log('BERHASIL: Aturan isolir MikroTik berhasil diarahkan ke http://167.71.200.190:3001/isolir.html');
    } else {
      console.log('GAGAL: setupIsolirRules mengembalikan false');
    }
  } catch (error) {
    console.error('Terjadi kesalahan:', error.message);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

run();
