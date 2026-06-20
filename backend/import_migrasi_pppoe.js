require('dotenv').config();
const fs = require('fs');
const db = require('./src/db/pool');
const radius = require('./src/services/radiusService');

async function main() {
  try {
    const rawData = fs.readFileSync('migrasi_pppoe.json', 'utf8');
    const data = JSON.parse(rawData);
    
    // Ambil paket-paket baru dari database
    const pkgRes = await db.query('SELECT * FROM packages');
    const newPackages = pkgRes.rows;
    
    let imported = 0;
    
    for (const m of data.pppoe) {
      // DELETE FROM members to fix previous mistake
      await db.query('DELETE FROM members WHERE username = $1', [m.username]);
      
      let matchedPackage = null;
      const oldPrice = parseFloat(m.package_price);
      
      if (oldPrice > 0) {
        matchedPackage = newPackages.find(p => parseFloat(p.price) === oldPrice && p.type === 'PPPoE');
        if (!matchedPackage) {
           matchedPackage = newPackages.find(p => parseFloat(p.price) === oldPrice);
        }
      }
      if (!matchedPackage) {
        matchedPackage = newPackages.find(p => p.name.toLowerCase().includes(m.package_name.toLowerCase()) || m.package_name.toLowerCase().includes(p.name.toLowerCase()));
      }
      if (!matchedPackage) {
        matchedPackage = newPackages.find(p => p.type === 'PPPoE');
        if (!matchedPackage) matchedPackage = newPackages[0]; 
        console.warn(`⚠️ PPPoE ${m.username} (Lama: ${m.package_name} - ${m.package_price}) dialihkan ke paket: ${matchedPackage.name}`);
      }
      
      const pkg = matchedPackage;
      
      let expiryDate = null;
      let isolirStatus = false;
      let checkAttrs = {
        'Cleartext-Password': m.password
      };
      
      if (m.valid_until) {
        expiryDate = m.valid_until.split(' ')[0]; // Convert DATETIME to DATE
        
        const expiresAt = new Date(m.valid_until);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const d = expiresAt.getDate().toString().padStart(2, '0');
        const mo = months[expiresAt.getMonth()];
        const y = expiresAt.getFullYear();
        const h = expiresAt.getHours().toString().padStart(2, '0');
        const min = expiresAt.getMinutes().toString().padStart(2, '0');
        const s = expiresAt.getSeconds().toString().padStart(2, '0');
        checkAttrs['Expiration'] = `${d} ${mo} ${y} ${h}:${min}:${s}`;
        
        // If expired, set as isolated
        if (expiresAt < new Date()) {
            isolirStatus = true;
        }
      }
      
      // Map to routers table
      const customerName = m.name || m.username;
      
      await db.query(`
        INSERT INTO routers (customer_name, pppoe_user, pppoe_pass, package_id, package_name, status, isolir, expiry_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (pppoe_user) DO UPDATE 
        SET pppoe_pass = EXCLUDED.pppoe_pass, package_id = EXCLUDED.package_id, expiry_date = EXCLUDED.expiry_date, isolir = EXCLUDED.isolir
      `, [customerName, m.username, m.password, pkg.id, pkg.name, isolirStatus ? 'Isolated' : 'Online', isolirStatus, expiryDate]);
      
      const replyAttrs = {};
      const rateLimit = radius.buildRateLimit(pkg);
      if (rateLimit) replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
      
      const groupName = radius.buildGroupName(pkg);
      
      // Update radius
      await radius.syncUserToRadius(m.username, m.password, groupName, replyAttrs, checkAttrs);
      
      if (isolirStatus) {
         await radius.isolirUser(m.username);
      }
      
      imported++;
    }
    
    console.log(`✅ Sukses memperbaiki dan memigrasi ${imported} PPPoE ke tabel Routers!`);
    
  } catch (error) {
    console.error('❌ Terjadi kesalahan import:', error);
  } finally {
    process.exit(0);
  }
}

main();
