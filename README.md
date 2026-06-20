# RadiusBill - Sistem Billing Hotspot & PPPoE

RadiusBill adalah sistem billing internet berbasis **Node.js**, **React**, dan **FreeRADIUS (PostgreSQL)**. Sistem ini dirancang untuk mengelola Voucher Hotspot, Member Bulanan, dan Klien PPPoE secara otomatis.

## Fitur Utama
- Manajemen Voucher (Generate, Print, Limitasi Waktu/Kuota/Kecepatan)
- Manajemen Member Hotspot (Pascabayar/Prabayar)
- Manajemen Klien PPPoE (Router)
- Native FreeRADIUS SQL Counter (Max-All-Session & Expiration)
- Multi-Router Mikrotik (MikroTik API terintegrasi)
- Laporan Keuangan & Statistik Traffic

---

## Panduan Instalasi Manual di Server (Ubuntu 22.04 / 24.04)

### 1. Persiapan Kebutuhan Server (Prerequisites)
Pastikan server Anda sudah di-update dan menginstal paket dasar.
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nano unzip build-essential
```

### 2. Instalasi PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
```
Buat Database dan User:
```bash
sudo -u postgres psql
```
Jalankan perintah SQL berikut di dalam console PostgreSQL:
```sql
CREATE DATABASE radius;
CREATE USER radius WITH PASSWORD 'radiuspassword';
GRANT ALL PRIVILEGES ON DATABASE radius TO radius;
\q
```

### 3. Instalasi Node.js & PM2
Gunakan NodeSource untuk menginstal Node.js versi 20 LTS.
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 4. Clone Repository
```bash
cd /var/www/
sudo git clone https://github.com/sihiver/RadiusBill.git biling-radius
sudo chown -R $USER:$USER /var/www/biling-radius
cd /var/www/biling-radius
```

### 5. Konfigurasi Backend & Database
Masuk ke folder backend, instal dependensi, dan sesuaikan file `.env`.
```bash
cd backend
npm install
cp .env.example .env
```
Edit file `.env` menggunakan editor teks (misal: `nano .env`) dan pastikan konfigurasi koneksi database Anda benar:
```env
DB_USER=radius
DB_HOST=localhost
DB_NAME=radius
DB_PASSWORD=radiuspassword
DB_PORT=5432
PORT=5000
JWT_SECRET=rahasia_super_aman
```

**Migrasi Database:**
Jalankan skrip inisialisasi tabel:
```bash
node src/db/init.js
```

### 6. Instalasi & Konfigurasi FreeRADIUS
RadiusBill menggunakan FreeRADIUS sebagai mesin autentikasi.
```bash
sudo apt install -y freeradius freeradius-postgresql freeradius-utils
```

**a. Konfigurasi Modul SQL**
Aktifkan modul `sql` FreeRADIUS:
```bash
sudo ln -s /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/
```
Edit file koneksi `/etc/freeradius/3.0/mods-available/sql`:
```bash
sudo nano /etc/freeradius/3.0/mods-available/sql
```
Pastikan pengaturan koneksinya sesuai dengan database PostgreSQL yang telah dibuat:
```text
dialect = "postgresql"
server = "localhost"
port = 5432
login = "radius"
password = "radiuspassword"
radius_db = "radius"
```

**b. Mengaktifkan SQL Counter (Limitasi)**
Sistem billing ini memanfaatkan fitur SQL Counter untuk menangani Batas Uptime (Durasi) dan Masa Aktif. Salin konfigurasi custom SQL Counter dari folder proyek:
```bash
sudo cp ../freeradius/default /etc/freeradius/3.0/sites-available/default
sudo cp ../freeradius/sqlcounter /etc/freeradius/3.0/mods-available/sqlcounter
sudo ln -s /etc/freeradius/3.0/mods-available/sqlcounter /etc/freeradius/3.0/mods-enabled/
```

**c. Restart FreeRADIUS**
```bash
sudo systemctl restart freeradius
sudo systemctl enable freeradius
```
*Jika gagal restart, periksa log dengan `sudo freeradius -X`.*

### 7. Konfigurasi Frontend
Masuk ke folder frontend dan instal dependensinya.
```bash
cd ../frontend
npm install
cp .env.example .env
```
Edit `.env` (pastikan IP menunjuk ke IP publik server / domain Anda):
```env
VITE_API_URL=http://IP_SERVER_ANDA:5000/api
```
**Build Frontend:**
```bash
npm run build
```

### 8. Menjalankan Aplikasi di Production (PM2)
Kembali ke folder backend dan jalankan via PM2 agar aplikasi selalu hidup di belakang layar:
```bash
cd ../backend
pm2 start src/index.js --name "radiusbill-api"
pm2 save
pm2 startup
```

Untuk menyajikan Frontend (React build) ke publik, Anda dapat mengkonfigurasi **Nginx** sebagai web server. Arahkan *Document Root* ke `/var/www/biling-radius/frontend/dist` dan lakukan reverse proxy untuk `/api` ke `http://127.0.0.1:5000`.

---

## Menghubungkan Mikrotik ke Server
Setelah aplikasi berjalan, buka Dashboard melalui browser, lalu tuju menu **Mikrotik**.
1. Tambahkan router Mikrotik Anda dengan menginput IP, Username (Full API), dan Password.
2. Di aplikasi Mikrotik (Winbox):
   - Masuk ke menu `Radius` -> Tambahkan *Radius Server* baru.
   - Centang **Hotspot** dan **PPP**.
   - Isi `Address` dengan IP Server RadiusBill.
   - Isi `Secret` dengan "rahasia" (Sesuai di file `clients.conf` FreeRADIUS atau di settingan NAS).

Selamat! Sistem RadiusBill Anda sudah siap digunakan. 🎉
