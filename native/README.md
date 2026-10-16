# RadiusBill Native Android (Kotlin & Jetpack Compose)

Aplikasi klien Android Native untuk sistem billing internet Hotspot & PPPoE **RadiusBill**, dibangun secara native menggunakan **Kotlin**, **Jetpack Compose (Material 3)**, dan **Clean MVVM Architecture**.

---

## 🚀 Fitur Unggulan

### 1. 🔐 Autentikasi & Sesi
- Login aman berbasis JWT Bearer Token.
- Penyimpanan kredensial sesi lokal (`PreferencesManager`).
- Penanganan otomatis kedaluwarsa sesi (`401 Unauthorized`) dengan pembersihan token dan kembali ke layar login.
- Informasi koneksi server host aktif.

### 2. 📊 Dashboard Interaktif
- **Ringkasan Finansial**: Total omset bulan ini dan estimasi pendapatan.
- **Sesi Aktif Online**: Jumlah pengguna hotspot/PPPoE yang sedang terhubung ke RADIUS (`radacct`).
- **Metrik Cepat**: Jumlah Voucher, Member Hotspot, Router PPPoE, dan User Online.
- **Grafik Batang Tren Pendapatan 7 Hari**: Visualisasi omset harian.
- **Live RADIUS Logs**: Riwayat autentikasi terbaru (Access-Accept, Access-Reject, Accounting) dilengkapi badge status dan IP pengguna.

### 3. 🎫 Manajemen Voucher Hotspot
- Filter status dinamis: **Semua**, **Aktif**, **Waiting (Belum Terpakai)**, dan **Expired**.
- Pencarian *real-time* berdasarkan kode voucher atau nama paket.
- Rincian voucher lengkap: kuota/pemakaian data (B/KB/MB/GB), sisa waktu, dan masa aktif.
- **Cetak Struk Thermal Bluetooth**: Cetak langsung ke printer thermal kasir (58mm/80mm) via Bluetooth ESC/POS.
- **Fallback Cetak Dokumen / PDF**: Jika printer Bluetooth tidak terhubung, sistem otomatis mencetak voucher format struk via Android `PrintManager`.
- **Bagikan (Share)**: Kirim kode voucher langsung ke WhatsApp, SMS, atau Telegram pelanggan.
- **Batch Generator Voucher**: Cetak voucher massal dengan opsi pemilihan paket, jumlah, dan prefix kode.

### 4. 👥 Manajemen Member Hotspot
- Daftar member langganan bulanan dengan inisial avatar.
- Formulir Tambah & Edit Member (Nama, Username, Password, No. HP, Paket).
- Fitur keamanan: **Kunci MAC (MAC Binding)** otomatis dan **Bypass Hotspot (IP Bind)**.
- **Perpanjang Masa Aktif**: Tambah masa aktif langganan (30 hari) dalam satu klik.
- Hapus member dengan dialog konfirmasi aman.
- Cetak struk langganan member via printer Bluetooth / PDF.
- Bagikan detail akun login via WhatsApp/SMS.

### 5. 🌐 Manajemen Klien Router PPPoE
- Monitoring status pelanggan PPPoE: **Online**, **Offline**, dan **Isolated**.
- Tambah & Edit Router Pelanggan (Nama Pelanggan, Username PPPoE, Password PPPoE, IP Router, Paket).
- **Fitur Isolir & Buka Isolir**: Blokir atau buka akses internet pelanggan yang menunggak secara langsung ke server dan Mikrotik.
- **Perpanjang Masa Aktif**: Perpanjang langganan PPPoE 30 hari.
- Hapus router dengan konfirmasi aman.

### 6. 📈 Laporan Keuangan (Reports)
- Slider pemilih periode 6 bulan terakhir.
- Ringkasan omset bulan terpilih dan omset hari ini.
- Rincian layanan aktif (Voucher Aktif, Member Aktif, Router PPPoE Aktif).
- Riwayat transaksi pendapatan harian dengan pencarian tanggal dan jenis layanan.

### 7. ⚙️ Pengaturan Printer & Server
- **Pengaturan Printer Thermal Bluetooth**:
  - Pindai perangkat Bluetooth yang telah dipasangkan (*bonded devices*).
  - Hubungkan (*connect*) dan putuskan (*disconnect*) printer kasir.
  - Fitur **Test Print** untuk memverifikasi kesiapan printer thermal.
  - Auto-reconnect ke printer yang tersimpan.
- **Pengaturan Server API**:
  - Ubah Base URL API secara dinamis (misal: alamat IP lokal `http://192.168.1.10:5000/api` saat pengujian atau domain publik).
  - Tombol Reset ke alamat default server RadiusBill.

---

## 🛠️ Arsitektur & Teknologi

- **Bahasa**: Kotlin (100% Native)
- **UI Toolkit**: Jetpack Compose dengan Material Design 3
- **Komponen Arsitektur**:
  - Jetpack Compose Navigation (`NavHost`, `BottomNavigationBar`)
  - StateFlow & Kotlin Coroutines
  - Android ViewModel (`androidx.lifecycle.viewmodel.compose`)
- **Networking**:
  - Retrofit 2.9.0 + Gson Converter
  - OkHttp 4.12.0 dengan Auth Interceptor & Logging
- **Pencetakan Kasir**:
  - Native Bluetooth RFCOMM Socket (Standard SPP UUID `00001101-0000-1000-8000-00805F9B34FB`)
  - Engine Perintah ESC/POS Native
  - Android PrintManager Document Adapter (PDF / Paper Print)

---

## 📂 Struktur Direktori

```
native/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/radiusbill/app/
│       │   ├── MainActivity.kt
│       │   ├── RadiusBillApp.kt
│       │   ├── data/
│       │   │   ├── api/
│       │   │   │   ├── ApiClient.kt
│       │   │   │   └── ApiService.kt
│       │   │   ├── local/
│       │   │   │   └── PreferencesManager.kt
│       │   │   └── model/
│       │   │       ├── ApiResponse.kt
│       │   │       ├── AuthModels.kt
│       │   │       ├── DashboardModels.kt
│       │   │       ├── MemberModels.kt
│       │   │       ├── PackageModels.kt
│       │   │       ├── ReportModels.kt
│       │   │       ├── RouterModels.kt
│       │   │       └── VoucherModels.kt
│       │   ├── ui/
│       │   │   ├── components/
│       │   │   │   ├── CommonComponents.kt
│       │   │   │   ├── Dialogs.kt
│       │   │   │   └── TopAppBar.kt
│       │   │   ├── navigation/
│       │   │   │   ├── AppNavigation.kt
│       │   │   │   └── NavItem.kt
│       │   │   ├── screens/
│       │   │   │   ├── dashboard/
│       │   │   │   │   ├── DashboardScreen.kt
│       │   │   │   │   └── DashboardViewModel.kt
│       │   │   │   ├── login/
│       │   │   │   │   ├── LoginScreen.kt
│       │   │   │   │   └── LoginViewModel.kt
│       │   │   │   ├── member/
│       │   │   │   │   ├── MemberScreen.kt
│       │   │   │   │   └── MemberViewModel.kt
│       │   │   │   ├── report/
│       │   │   │   │   ├── ReportScreen.kt
│       │   │   │   │   └── ReportViewModel.kt
│       │   │   │   ├── router/
│       │   │   │   │   ├── RouterScreen.kt
│       │   │   │   │   └── RouterViewModel.kt
│       │   │   │   ├── settings/
│       │   │   │   │   ├── SettingsScreen.kt
│       │   │   │   │   └── SettingsViewModel.kt
│       │   │   │   └── voucher/
│       │   │   │       ├── VoucherScreen.kt
│       │   │   │       └── VoucherViewModel.kt
│       │   │   └── theme/
│       │   │       ├── Color.kt
│       │   │       ├── Theme.kt
│       │   │       └── Type.kt
│       │   └── util/
│       │       ├── Formatters.kt
│       │       ├── PrintUtils.kt
│       │       └── ThermalPrinterManager.kt
│       └── res/
│           ├── drawable/
│           ├── mipmap-*/
│           └── values/
│               ├── strings.xml
│               └── themes.xml
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── build.gradle.kts
├── gradle.properties
├── gradlew
├── gradlew.bat
├── local.properties
└── settings.gradle.kts
```

---

## 📱 Cara Membuka & Menjalankan di Android Studio

1. Buka **Android Studio**.
2. Pilih menu **Open** dan arahkan ke folder `/home/dindin/StudioProjects/RadiusBill/native`.
3. Tunggu proses *Gradle Sync* selesai (menggunakan JDK 17 atau JDK 21).
4. Hubungkan perangkat Android fisik atau jalankan Android Emulator.
5. Klik tombol **Run 'app'** (`Shift + F10`) untuk meng-install dan menjalankan aplikasi.
