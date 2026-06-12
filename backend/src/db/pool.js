// ─── PostgreSQL Connection Pool ───────────────────────────────────────────────
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'radius',
  user:     process.env.DB_USER     || 'radius',
  password: process.env.DB_PASSWORD || 'radpass',
  min:      parseInt(process.env.DB_POOL_MIN || '2'),
  max:      parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors (connection lost, etc.)
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] New connection acquired from pool');
  }
});

/**
 * Run a query with optional parameterized values.
 * @param {string} text   SQL string
 * @param {Array}  params Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`[DB SLOW QUERY] ${duration}ms — ${text.slice(0, 100)}`);
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

/**
 * Get a single client from pool for transactions.
 * Remember to call client.release() in a finally block.
 */
async function getClient() {
  return pool.connect();
}

/**
 * Test database connectivity.
 */
async function testConnection() {
  const res = await query('SELECT NOW() AS now, current_database() AS db');
  return res.rows[0];
}

module.exports = { query, getClient, pool, testConnection };
