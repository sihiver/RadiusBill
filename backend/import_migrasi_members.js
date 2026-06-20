require('dotenv').config();
const fs = require('fs');
const db = require('./src/db/pool');
const radius = require('./src/services/radiusService');

async function main() {
  try {
    const rawData = fs.readFileSync('migrasi_members.json', 'utf8');
    const data = JSON.parse(rawData);
    
    // Ambil paket-paket baru dari database
    const pkgRes = await db.query('SELECT * FROM packages');
    const newPackages = pkgRes.rows;
    
    console.log(`[Import] Ditemukan ${newPackages.length} paket baru di database.`);
    
    let imported = 0;
    
    for (const m of data.members) {
      // Pemetaan Paket Cerdas (berdasarkan Harga atau Nama)
      let matchedPackage = null;
      const oldPrice = parseFloat(m.package_price);
      
      // 1. Coba cari berdasarkan harga yang sama persis
      if (oldPrice > 0) {
        matchedPackage = newPackages.find(p => parseFloat(p.price) === oldPrice);
      }
      
      // 2. Jika tidak ketemu harga, cari berdasarkan nama yang mirip
      if (!matchedPackage) {
        matchedPackage = newPackages.find(p => p.name.toLowerCase().includes(m.package_name.toLowerCase()) || m.package_name.toLowerCase().includes(p.name.toLowerCase()));
      }
      
      // 3. Jika tetap tidak ketemu, berikan paket default ID 1 (atau skip)
      if (!matchedPackage) {
        matchedPackage = newPackages[0]; 
        console.warn(`⚠️ Member ${m.username} (Paket Lama: ${m.package_name} - ${m.package_price}) tidak cocok dengan paket baru. Dialihkan ke paket: ${matchedPackage.name}`);
      }
      
      const pkg = matchedPackage;
      
      let expiryDate = null;
      let checkAttrs = {
        'Cleartext-Password': m.password
      };
      
      if (m.valid_until) {
        expiryDate = m.valid_until.split(' ')[0]; // Convert DATETIME to DATE
        
        // Format Expiration untuk radius
        const expiresAt = new Date(m.valid_until);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const d = expiresAt.getDate().toString().padStart(2, '0');
        const mo = months[expiresAt.getMonth()];
        const y = expiresAt.getFullYear();
        const h = expiresAt.getHours().toString().padStart(2, '0');
        const min = expiresAt.getMinutes().toString().padStart(2, '0');
        const s = expiresAt.getSeconds().toString().padStart(2, '0');
        checkAttrs['Expiration'] = `${d} ${mo} ${y} ${h}:${min}:${s}`;
      }
      
      // Insert Database
      await db.query(`
        INSERT INTO members (name, username, password, package_id, package_name, expiry_date, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (username) DO UPDATE 
        SET expiry_date = EXCLUDED.expiry_date, package_id = EXCLUDED.package_id, password = EXCLUDED.password
      `, [m.name || m.username, m.username, m.password, pkg.id, pkg.name, expiryDate]);
      
      const replyAttrs = {};
      const rateLimit = radius.buildRateLimit(pkg);
      if (rateLimit) replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
      
      const groupName = radius.buildGroupName(pkg);
      
      // Sinkronisasi FreeRADIUS
      await radius.syncUserToRadius(m.username, m.password, groupName, replyAttrs, checkAttrs);
      imported++;
    }
    
    console.log(`✅ Sukses memigrasi ${imported} member ke PostgreSQL dan FreeRADIUS!`);
    
  } catch (error) {
    console.error('❌ Terjadi kesalahan import:', error);
  } finally {
    process.exit(0);
  }
}

main();
