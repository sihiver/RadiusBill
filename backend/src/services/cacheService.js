// ─── Cache Service (Redis wrapper) ────────────────────────────────────────────
const { getRedisClient } = require('../db/redis');

const PREFIX = 'rtrwnet:';

// Default TTLs (seconds)
const TTL = {
  PACKAGES:     parseInt(process.env.CACHE_TTL_PACKAGES     || '300'),
  VOUCHERS:     parseInt(process.env.CACHE_TTL_VOUCHERS     || '30'),
  MEMBERS:      parseInt(process.env.CACHE_TTL_MEMBERS      || '60'),
  STATS:        parseInt(process.env.CACHE_TTL_STATS        || '60'),
  RADIUS_LOGS:  parseInt(process.env.CACHE_TTL_RADIUS_LOGS  || '30'),
};

function key(name) {
  return `${PREFIX}${name}`;
}

/**
 * Get cached value. Returns parsed JSON or null if miss/error.
 */
async function cacheGet(name) {
  try {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return null;
    const raw = await redis.get(key(name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set cache with optional TTL.
 * @param {string} name  Cache key name (without prefix)
 * @param {*}      value Value to cache (will be JSON.stringify'd)
 * @param {number} ttl   TTL in seconds (default: 60)
 */
async function cacheSet(name, value, ttl = 60) {
  try {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;
    await redis.set(key(name), JSON.stringify(value), 'EX', ttl);
  } catch {
    // Redis failure is non-fatal
  }
}

/**
 * Delete a cache key.
 */
async function cacheDel(name) {
  try {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;
    await redis.del(key(name));
  } catch { /* non-fatal */ }
}

/**
 * Delete multiple cache keys by pattern.
 * e.g. cacheDelPattern('vouchers:*') 
 */
async function cacheDelPattern(pattern) {
  try {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;
    const keys = await redis.keys(`${PREFIX}${pattern}`);
    if (keys.length > 0) await redis.del(...keys);
  } catch { /* non-fatal */ }
}

/**
 * Cache-aside helper: get from cache, or call fn() and cache result.
 * @param {string}   name  Cache key
 * @param {Function} fn    Async function to call on cache miss
 * @param {number}   ttl   TTL in seconds
 */
async function cacheAside(name, fn, ttl = 60) {
  const cached = await cacheGet(name);
  if (cached !== null) return cached;
  const result = await fn();
  await cacheSet(name, result, ttl);
  return result;
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPattern, cacheAside, TTL };
