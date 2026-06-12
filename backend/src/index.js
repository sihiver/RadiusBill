// ─── Express App Entry Point ──────────────────────────────────────────────────
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const { connectRedis }     = require('./db/redis');
const { testConnection }   = require('./db/pool');
const { errorHandler }     = require('./middleware/errorHandler');
const { startExpireJob }   = require('./jobs/expireVouchers');

// Routes
const packagesRouter    = require('./routes/packages');
const vouchersRouter    = require('./routes/vouchers');
const voucherLogsRouter = require('./routes/voucherLogs');
const membersRouter     = require('./routes/members');
const routersRouter     = require('./routes/routers');
const radiusRouter      = require('./routes/radius');
const dashboardRouter   = require('./routes/dashboard');
const settingsRouter    = require('./routes/settings');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
});
app.use('/api', limiter);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const dbInfo = await testConnection();
    res.json({
      success: true,
      status: 'OK',
      version: '1.0.0',
      db: dbInfo,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ success: false, status: 'DB Unavailable', error: err.message });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/packages',     packagesRouter);
app.use('/api/vouchers',     vouchersRouter);
app.use('/api/voucher-logs', voucherLogsRouter);
app.use('/api/members',      membersRouter);
app.use('/api/routers',      routersRouter);
app.use('/api/radius',       radiusRouter);
app.use('/api/dashboard',    dashboardRouter);
app.use('/api/settings',     settingsRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint tidak ditemukan: ${req.method} ${req.path}` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // 1. Test DB connection
    console.log('[App] Menghubungkan ke PostgreSQL...');
    const dbInfo = await testConnection();
    console.log(`[App] PostgreSQL terhubung ✓ — DB: ${dbInfo.db}`);

    // 2. Connect Redis (non-blocking, graceful fallback)
    await connectRedis();

    // 3. Start cron jobs
    startExpireJob();

    // 4. Start HTTP server
    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════════╗`);
      console.log(`║   RT/RW NET Billing Backend                 ║`);
      console.log(`║   http://localhost:${PORT}                     ║`);
      console.log(`║   ENV: ${(process.env.NODE_ENV || 'development').padEnd(36)}║`);
      console.log(`╚══════════════════════════════════════════════╝\n`);
    });
  } catch (err) {
    console.error('[App] Gagal start:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => { console.log('[App] SIGTERM — shutting down'); process.exit(0); });
process.on('SIGINT',  () => { console.log('[App] SIGINT — shutting down');  process.exit(0); });

bootstrap();
