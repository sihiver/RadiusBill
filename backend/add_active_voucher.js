require('dotenv').config();
const db = require('./src/db/pool');
const radius = require('./src/services/radiusService');

async function addManualActiveVoucher(code, expiryDateStr, packageId) {
  try {
    // 1. Ambil detail paket dari database
    const pkgRes = await db.query('SELECT * FROM packages WHERE id = $1', [packageId]);
    const pkg = pkgRes.rows[0];
    if (!pkg) {
      console.error(`❌ Paket dengan ID ${packageId} tidak ditemukan!`);
      process.exit(1);
    }

    const expiresAt = new Date(expiryDateStr);
    
    // 2. Insert ke tabel vouchers
    await db.query(`
      INSERT INTO vouchers (code, password, package_id, package_name, price, status, activated_at, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, 'Active', NOW(), $6, 'admin_manual')
      ON CONFLICT (code) DO UPDATE 
      SET expires_at = $6, status = 'Active', activated_at = COALESCE(vouchers.activated_at, NOW())
    `, [code, code, pkg.id, pkg.name, pkg.price, expiresAt]);

    // 3. Konversi format waktu untuk FreeRADIUS (DD MMM YYYY HH:mm:ss)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = expiresAt.getDate().toString().padStart(2, '0');
    const m = months[expiresAt.getMonth()];
    const y = expiresAt.getFullYear();
    const h = expiresAt.getHours().toString().padStart(2, '0');
    const min = expiresAt.getMinutes().toString().padStart(2, '0');
    const s = expiresAt.getSeconds().toString().padStart(2, '0');
    const radiusExpiry = `${d} ${m} ${y} ${h}:${min}:${s}`;

    // 4. Set atribut kecepatan dan jatuh tempo ke FreeRADIUS
    const replyAttrs = {};
    const rateLimit = radius.buildRateLimit(pkg);
    if (rateLimit) replyAttrs['Mikrotik-Rate-Limit'] = rateLimit;

    const checkAttrs = {
      'Expiration': radiusExpiry
    };

    const groupName = radius.buildGroupName(pkg);

    // 5. Eksekusi sinkronisasi ke FreeRADIUS
    await radius.syncUserToRadius(code, code, groupName, replyAttrs, checkAttrs);

    console.log(`✅ BERHASIL!`);
    console.log(`🎟️ Kode Voucher : ${code}`);
    console.log(`📦 Paket        : ${pkg.name}`);
    console.log(`⏰ Kedaluwarsa  : ${radiusExpiry}`);

  } catch (error) {
    console.error('❌ Terjadi kesalahan:', error.message);
  } finally {
    process.exit(0);
  }
}

// ==========================================
// PENGATURAN VOUCHER (Ubah baris di bawah ini)
// ==========================================
const KODE_VOUCHER = 'B20Q4RJ';
const TANGGAL_EXPIRED = '2026-06-25 23:59:59';
const ID_PAKET = 1; // Ganti dengan ID paket yang sesuai (Cek di menu Paket bandwidth)

addManualActiveVoucher(KODE_VOUCHER, TANGGAL_EXPIRED, ID_PAKET);
