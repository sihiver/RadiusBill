#!/usr/bin/env node
// ─── Database Migration Runner ────────────────────────────────────────────────
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[Migrate] Found ${files.length} migration file(s)`);

  const client = await pool.connect();
  try {
    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(200) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const res = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1', [file]
      );
      if (res.rows.length > 0) {
        console.log(`[Migrate] SKIP: ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[Migrate] Applying: ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migrate] ✓ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrate] ✗ Failed: ${file}`, err.message);
        throw err;
      }
    }

    console.log('\n[Migrate] All migrations applied successfully ✓');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('[Migrate] Fatal error:', err.message);
  process.exit(1);
});
