// ─── Redis Client (ioredis) ───────────────────────────────────────────────────
const Redis = require('ioredis');

let redisClient = null;

function getRedisClient() {
  if (redisClient) return redisClient;

  redisClient = new Redis({
    host:           process.env.REDIS_HOST     || 'localhost',
    port:           parseInt(process.env.REDIS_PORT || '6379'),
    password:       process.env.REDIS_PASSWORD || undefined,
    db:             parseInt(process.env.REDIS_DB   || '0'),
    retryStrategy(times) {
      if (times > 5) {
        console.error('[Redis] Max retries reached. Disabling Redis.');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  redisClient.on('connect',      () => console.log('[Redis] Connected'));
  redisClient.on('error',  (err) => console.error('[Redis] Error:', err.message));
  redisClient.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

  return redisClient;
}

async function connectRedis() {
  const client = getRedisClient();
  try {
    await client.connect();
    await client.ping();
    console.log('[Redis] Ready ✓');
  } catch (err) {
    console.warn('[Redis] Could not connect:', err.message, '— caching disabled');
  }
}

module.exports = { getRedisClient, connectRedis };
