require('dotenv').config();
const db = require('./src/db/pool');

async function clean() {
  try {
    const res = await db.query(`
      DELETE FROM transactions
      WHERE type = 'voucher' 
      AND reference_id IN (
        SELECT code FROM vouchers WHERE status = 'Unused'
      )
      RETURNING *;
    `);
    console.log(`Berhasil menghapus ${res.rowCount} transaksi voucher yang belum digunakan.`);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

clean();
