# RT/RW NET Billing — Backend

Backend API untuk sistem billing RT/RW NET menggunakan **Node.js + Express**, **PostgreSQL**, **Redis**, dan integrasi **FreeRADIUS**.

## 📁 Struktur

```
backend/
├── src/
│   ├── index.js              # Entry point
│   ├── db/
│   │   ├── pool.js           # PostgreSQL connection pool
│   │   ├── redis.js          # Redis client
│   │   ├── migrate.js        # Migration runner
│   │   ├── seed.sql          # Data sample
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   ├── services/
│   │   ├── radiusService.js  # FreeRADIUS sync
│   │   └── cacheService.js   # Redis cache-aside
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── packages.js
│   │   ├── vouchers.js       # Voucher AKTIF
│   │   ├── voucherLogs.js    # Voucher HANGUS (tabel terpisah)
│   │   ├── members.js
│   │   ├── routers.js
│   │   ├── radius.js
│   │   ├── dashboard.js
│   │   └── settings.js
│   └── jobs/
│       └── expireVouchers.js # Cron: auto-move expired vouchers
├── .env
├── .env.example
├── Dockerfile
└── package.json
```

## 🚀 Quick Start

### Option A: Docker Compose (Recommended)

```bash
# Clone & start semua services
cd /home/dindin/VisualCode/biling-radius
docker-compose up -d

# Cek status
docker-compose ps
docker-compose logs backend
```

### Option B: Manual (Local Development)

#### 1. Install PostgreSQL & Redis

```bash
# Ubuntu/Debian
sudo apt install postgresql-16 redis-server

# Buat database
sudo -u postgres psql -c "CREATE USER radius WITH PASSWORD 'radpass';"
sudo -u postgres psql -c "CREATE DATABASE radius OWNER radius;"
sudo -u postgres psql -c "GRANT ALL ON DATABASE radius TO radius;"
```

#### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Copy & edit .env
cp .env.example .env
# Edit sesuai konfigurasi lokal

# Jalankan migrasi
npm run db:migrate

# Seed data sample (opsional)
psql -U radius -d radius -f src/db/seed.sql

# Start server
npm run dev
```

#### 3. Start Frontend

```bash
cd frontend
npm run dev
```

## 📡 API Endpoints

| Method | Endpoint                          | Deskripsi                              |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/health`                     | Health check + DB status               |
| GET    | `/api/packages`                   | List paket internet                    |
| GET    | `/api/vouchers`                   | List voucher **AKTIF**                 |
| GET    | `/api/voucher-logs`               | List voucher **HANGUS** (tabel pisah)  |
| POST   | `/api/vouchers/generate`          | Generate batch voucher baru            |
| POST   | `/api/vouchers/:id/disconnect`    | Putus sesi + pindah ke voucher_logs    |
| GET    | `/api/members`                    | List member hotspot                    |
| POST   | `/api/members/:id/extend`         | Perpanjang masa aktif                  |
| GET    | `/api/routers`                    | List router PPPoE                      |
| POST   | `/api/routers/:id/isolir`         | Isolir pelanggan                       |
| POST   | `/api/routers/:id/unisolir`       | Lepas isolir                           |
| GET    | `/api/radius/status`              | Status FreeRADIUS                      |
| GET    | `/api/radius/sessions`            | Sesi aktif dari radacct                |
| POST   | `/api/radius/sync`                | Full re-sync ke FreeRADIUS             |
| GET    | `/api/dashboard/stats`            | Statistik dashboard                    |
| GET/PUT| `/api/settings`                   | Pengaturan sistem                      |

## 🗄️ Skema Database

### Tabel Billing (Custom)
| Tabel            | Keterangan                          |
|------------------|-------------------------------------|
| `packages`       | Paket internet (Hotspot & PPPoE)    |
| `vouchers`       | Voucher **AKTIF** (Unused/Active)   |
| `voucher_logs`   | Voucher **HANGUS** — TABEL PISAH   |
| `members`        | Member hotspot bulanan              |
| `member_sessions`| Riwayat sesi member                 |
| `routers`        | Router PPPoE pelanggan              |
| `radius_logs`    | Log aktivitas billing               |
| `system_settings`| Konfigurasi sistem                  |

### Tabel FreeRADIUS (Standard)
| Tabel            | Keterangan                          |
|------------------|-------------------------------------|
| `radcheck`       | Auth rules per user                 |
| `radreply`       | Reply attributes (speed limit)      |
| `radusergroup`   | User-group mapping                  |
| `radgroupcheck`  | Group auth rules                    |
| `radgroupreply`  | Group reply attributes              |
| `radacct`        | Accounting sessions (FreeRADIUS)    |
| `radpostauth`    | Post-auth log                       |
| `nas`            | NAS clients (MikroTik)              |

## 🔐 FreeRADIUS Integration

### Setup FreeRADIUS

```bash
# Install FreeRADIUS dengan PostgreSQL support
sudo apt install freeradius freeradius-postgresql

# Copy konfigurasi
sudo cp freeradius/sql.conf /etc/freeradius/3.0/mods-available/sql
sudo cp freeradius/clients.conf /etc/freeradius/3.0/clients.conf

# Aktifkan modul SQL
sudo ln -sf /etc/freeradius/3.0/mods-available/sql \
            /etc/freeradius/3.0/mods-enabled/sql

# Test konfigurasi
sudo freeradius -X

# Start service
sudo systemctl enable --now freeradius
```

### Test Auth

```bash
# Test voucher/user authentication
radtest RW-A93K7 RW-A93K7 127.0.0.1 0 testing123

# Expected response:
# Received Access-Accept
```

## ⚙️ Database Indexes (Mandatory)

Semua index sudah dibuat di migration:

- `idx_vouchers_code` — UNIQUE, untuk lookup kode voucher
- `idx_vouchers_status` — filter by status (Active/Unused)
- `idx_voucher_logs_expired_at` — query voucher hangus by tanggal
- `idx_members_username` — UNIQUE, auth member
- `idx_routers_pppoe_user` — UNIQUE, auth PPPoE
- `idx_radacct_username` — FreeRADIUS accounting query
- `idx_radacct_active_sessions` — Partial index, sesi aktif (hot path)
- `idx_radcheck_username` — FreeRADIUS auth lookup
- Dan 10+ index lainnya...

## 🔄 Cron Jobs

| Job             | Schedule      | Fungsi                                |
|-----------------|---------------|---------------------------------------|
| expireVouchers  | `*/5 * * * *` | Auto-MOVE expired vouchers ke voucher_logs |

## 📦 Tech Stack

- **Runtime**: Node.js 20 + Express 4
- **Database**: PostgreSQL 16 (pg.Pool)
- **Cache**: Redis 7 (ioredis)
- **Validation**: Joi
- **Scheduler**: node-cron
- **Security**: helmet, express-rate-limit, cors
