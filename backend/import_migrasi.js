require('dotenv').config();
const fs = require('fs');
const db = require('./src/db/pool');
const radius = require('./src/services/radiusService');

async function main() {
  try {
    const rawData = fs.readFileSync('migrasi_vouchers.json', 'utf8');
    const data = JSON.parse(rawData);
    
    // Ambil paket-paket baru dari database
    const pkgRes = await db.query('SELECT * FROM packages');
    const newPackages = pkgRes.rows;
    
    console.log(`[Import] Ditemukan ${newPackages.length} paket baru di database.`);
    
    let imported = 0;
    
    for (const v of data.vouchers) {
      // Pemetaan Paket Cerdas (berdasarkan Harga atau Nama)
      let matchedPackage = null;
      const oldPrice = parseFloat(v.package_price);
      
      // 1. Coba cari berdasarkan harga yang sama persis
      if (oldPrice > 0) {
        matchedPackage = newPackages.find(p => parseFloat(p.price) === oldPrice);
      }
      
      // 2. Jika tidak ketemu harga, cari berdasarkan nama yang mirip
      if (!matchedPackage) {
        matchedPackage = newPackages.find(p => p.name.toLowerCase().includes(v.package_name.toLowerCase()) || v.package_name.toLowerCase().includes(p.name.toLowerCase()));
      }
      
      // 3. Jika tetap tidak ketemu, berikan paket default ID 1 (atau skip)
      if (!matchedPackage) {
        matchedPackage = newPackages[0]; 
        console.warn(`⚠️ Voucher ${v.code} (Paket Lama: ${v.package_name} - ${v.package_price}) tidak cocok dengan paket baru. Dialihkan ke paket: ${matchedPackage.name}`);
      }
      
      const pkg = matchedPackage;
      
      let expiresAt = null;
      let checkAttrs = {};
      
      if (v.status === 'Active' && v.valid_until) {
        expiresAt = new Date(v.valid_until);
        
        // Format Expiration untuk radius
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const d = expiresAt.getDate().toString().padStart(2, '0');
        const m = months[expiresAt.getMonth()];
        const y = expiresAt.getFullYear();
        const h = expiresAt.getHours().toString().padStart(2, '0');
        const min = expiresAt.getMinutes().toString().padStart(2, '0');
        const s = expiresAt.getSeconds().toString().padStart(2, '0');
        checkAttrs['Expiration'] = `${d} ${m} ${y} ${h}:${min}:${s}`;
      } else if (v.status === 'Unused') {
        // Jika belum dipakai, Expire-After belum berjalan, namun kita set Expire-After berdasarkan pkg.validity
        const radiusValidity = formatMikrotikToRadius(pkg.validity);
        if (radiusValidity) {
            checkAttrs['Expire-After'] = radiusValidity.toString();
        }
      }
      
      // Insert Database
      await db.query(`
        INSERT INTO vouchers (code, password, package_id, package_name, price, status, activated_at, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'migration_script')
        ON CONFLICT (code) DO UPDATE 
        SET status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, package_id = EXCLUDED.package_id
      `, [v.code, v.code, pkg.id, pkg.name, pkg.price, v.status, v.used_at, expiresAt]);
      
      const replyAttrs = {};
      const rateLimit = radius.buildRateLimit(pkg);
      if (rateLimit) replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;
      
      const groupName = radius.buildGroupName(pkg);
      
      // Sinkronisasi FreeRADIUS
      await radius.syncUserToRadius(v.code, v.code, groupName, replyAttrs, checkAttrs);
      imported++;
    }
    
    console.log(`✅ Sukses memigrasi ${imported} voucher ke PostgreSQL dan FreeRADIUS!`);
    
  } catch (error) {
    console.error('❌ Terjadi kesalahan import:', error);
  } finally {
    process.exit(0);
  }
}

function formatMikrotikToRadius(durationStr) {
    if (!durationStr || durationStr.toLowerCase() === 'unlimited') return null;
    let totalSeconds = 0;
    const regex = /(\d+)\s*([wdhms])/gi;
    let match;
    let matchedMikrotik = false;
    while ((match = regex.exec(durationStr)) !== null) {
      matchedMikrotik = true;
      const val = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'w') totalSeconds += val * 7 * 86400;
      else if (unit === 'd') totalSeconds += val * 86400;
      else if (unit === 'h') totalSeconds += val * 3600;
      else if (unit === 'm') totalSeconds += val * 60;
      else if (unit === 's') totalSeconds += val;
    }
    if (matchedMikrotik) return totalSeconds;
    const oldMatch = durationStr.match(/(\d+)\s*(Hari|Jam|Menit|Minggu|Bulan)/i);
    if (!oldMatch) return null;
    const [, num, unit] = oldMatch;
    const n = parseInt(num);
    if (/menit/i.test(unit))  return n * 60;
    if (/jam/i.test(unit))    return n * 3600;
    if (/minggu/i.test(unit)) return n * 7 * 86400;
    if (/bulan/i.test(unit))  return n * 30 * 86400;
    return n * 86400; // Hari
}

main();
