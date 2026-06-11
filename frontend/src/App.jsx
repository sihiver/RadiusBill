import React, { useState, useEffect, useMemo } from 'react';
import DashboardOverview from './components/DashboardOverview';
import PackageManagement from './components/PackageManagement';
import VoucherGenerator from './components/VoucherGenerator';
import ActiveVoucherLog from './components/ActiveVoucherLog';
import MemberList from './components/MemberList';
import BrowserSessions from './components/BrowserSessions';
import RouterList from './components/RouterList';
import MonitoringIsolir from './components/MonitoringIsolir';

// ─── localStorage helpers ───────────────────────────────────────────────────
function loadState(key, fallbackFn) {
  try {
    const raw = localStorage.getItem(`rtrwnet_${key}`);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupted – fall through */ }
  return typeof fallbackFn === 'function' ? fallbackFn() : fallbackFn;
}
function saveState(key, value) {
  try { localStorage.setItem(`rtrwnet_${key}`, JSON.stringify(value)); } catch { /* quota */ }
}

// ─── Default mock data factories (Date.now() is fresh on each cold start) ───
const defaultPackages = () => [
  { id: 1, name: 'Hotspot Hemat 5Mbps', type: 'Hotspot', speedUpload: '2 Mbps', speedDownload: '5 Mbps', validity: '30 Hari', price: 50000, description: 'Paket portal hotspot bulanan perumahan.' },
  { id: 2, name: 'Hotspot Eceran 2Mbps', type: 'Hotspot', speedUpload: '1 Mbps', speedDownload: '2 Mbps', validity: '1 Hari', price: 3000, description: 'Voucher eceran murah untuk akses harian.' },
  { id: 3, name: 'PPPoE Home 10Mbps', type: 'PPPoE', speedUpload: '3 Mbps', speedDownload: '10 Mbps', validity: '30 Hari', price: 100000, description: 'Router rumah unlimited standar bulanan.' },
  { id: 4, name: 'PPPoE Premium 20Mbps', type: 'PPPoE', speedUpload: '5 Mbps', speedDownload: '20 Mbps', validity: '30 Hari', price: 180000, description: 'Router rumah premium unlimited bulanan.' },
];

const defaultVouchers = () => {
  const now = Date.now();
  return [
    { id: 101, code: 'RW-A93K7', password: 'RW-A93K7', package: 'Hotspot Eceran 2Mbps', price: 3000, status: 'Active', ipAddress: '192.168.1.45', activatedTime: '10 Jun 13:10', usedBytes: '420 MB', timeLeft: '18 Jam 22 Menit', expiresAt: now + 18 * 3600000 + 22 * 60000 },
    { id: 102, code: 'RW-P82X9', password: 'RW-P82X9', package: 'Hotspot Eceran 2Mbps', price: 3000, status: 'Active', ipAddress: '192.168.1.67', activatedTime: '10 Jun 13:25', usedBytes: '110 MB', timeLeft: '22 Jam 37 Menit', expiresAt: now + 22 * 3600000 + 37 * 60000 },
    { id: 103, code: 'RW-H92B8', password: 'RW-H92B8', package: 'Hotspot Hemat 5Mbps', price: 50000, status: 'Unused', ipAddress: '-', activatedTime: '-', usedBytes: '0 MB', timeLeft: '30 Hari' },
    { id: 104, code: 'RW-Z17Q2', password: 'RW-Z17Q2', package: 'Hotspot Hemat 5Mbps', price: 50000, status: 'Expired', ipAddress: '-', activatedTime: '09 Jun 12:00', usedBytes: '5.2 GB', timeLeft: 'Sesi Selesai', expiresAt: now - 24 * 3600000 },
  ];
};

const defaultMembers = () => {
  const now = Date.now();
  return [
    { id: 201, name: 'Budi Santoso', username: 'budi_san', phone: '081234567890', email: 'budi@gmail.com', package: 'Hotspot Hemat 5Mbps', balance: 75000, expiryDate: '2026-07-10', activeSession: true, ipAddress: '192.168.1.120', sessionStartedAt: now - 4 * 3600000 - 12 * 60000 },
    { id: 202, name: 'Siti Aminah', username: 'siti_a', phone: '085712345678', email: 'siti@outlook.com', package: 'Hotspot Hemat 5Mbps', balance: 20000, expiryDate: '2026-07-02', activeSession: false, ipAddress: '-' },
    { id: 203, name: 'Rian Hidayat', username: 'rian_h', phone: '089987654321', email: 'rian@yahoo.com', package: 'Hotspot Eceran 2Mbps', balance: 5000, expiryDate: '2026-06-11', activeSession: true, ipAddress: '192.168.1.125', sessionStartedAt: now - 1 * 3600000 - 45 * 60000 },
  ];
};

const defaultRouters = () => [
  { id: 301, customerName: 'Bapak Ahmad (Blok A3)', pppoeUser: 'router_ahmad', pppoePass: 'ahmad123', routerIp: '10.10.10.2', package: 'PPPoE Home 10Mbps', status: 'Online', isolir: false },
  { id: 302, customerName: 'Ibu Ratna (Blok B12)', pppoeUser: 'router_ratna', pppoePass: 'ratna456', routerIp: '10.10.10.3', package: 'PPPoE Home 10Mbps', status: 'Online', isolir: false },
  { id: 303, customerName: 'Pak Wahyu (Blok C8)', pppoeUser: 'router_wahyu', pppoePass: 'wahyu789', routerIp: '10.10.10.4', package: 'PPPoE Premium 20Mbps', status: 'Offline', isolir: false },
  { id: 304, customerName: 'Bu Dewi (Blok F15) - Late Payment', pppoeUser: 'router_dewi', pppoePass: 'dewi321', routerIp: '10.10.10.5', package: 'PPPoE Home 10Mbps', status: 'Isolated', isolir: true },
];

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Core UI state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [radiusStatus, setRadiusStatus] = useState('Connected');
  const [currentTime, setCurrentTime] = useState('');

  // ── Global search ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  // ── Custom Confirm Dialog ─────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Ya',
    cancelText: 'Batal',
    variant: 'danger'
  });

  const requestConfirm = (options) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title || 'Konfirmasi',
      message: options.message,
      onConfirm: options.onConfirm,
      confirmText: options.confirmText || 'Ya, Lanjutkan',
      cancelText: options.cancelText || 'Batal',
      variant: options.variant || 'danger'
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  // ── Data state (persisted in localStorage) ────────────────────────────────
  const [packages, setPackages]   = useState(() => loadState('packages', defaultPackages));
  const [vouchers, setVouchers]   = useState(() => loadState('vouchers', defaultVouchers));
  const [members, setMembers]     = useState(() => loadState('members', defaultMembers));
  const [routers, setRouters]     = useState(() => loadState('routers', defaultRouters));
  const [isDark, setIsDark]       = useState(() => loadState('theme_dark', false));

  // Update HTML class for dark mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('rtrwnet_theme_dark', JSON.stringify(isDark));
  }, [isDark]);

  // ── FreeRADIUS live logs (NOT persisted – fresh each session) ─────────────
  const [logs, setLogs] = useState([
    { id: 1, time: '13:30:05', type: 'SYSTEM', message: 'System initialized. FreeRADIUS listening on port 1812/1813...' },
    { id: 2, time: '13:31:12', type: 'AUTH', user: 'user_0892', ip: '192.168.1.45', service: 'Hotspot' },
    { id: 3, time: '13:31:45', type: 'AUTH', user: 'router_ahmad', ip: '10.10.10.2', service: 'PPPoE' },
    { id: 4, time: '13:32:10', type: 'REJECT', user: 'guest_temp', ip: '192.168.1.102', reason: 'Invalid password' },
    { id: 5, time: '13:33:02', type: 'ACCT', action: 'Start', user: 'user_0892', session: '88A9B2' },
  ]);

  // ── Notification helper ───────────────────────────────────────────────────
  const addNotification = (message, variant = 'info') => {
    const now = new Date();
    const id = Date.now();
    setNotifications(prev => [{
      id,
      message,
      variant, // 'info' | 'warning' | 'success' | 'error'
      time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    }, ...prev.slice(0, 29)]); // keep last 30
    
    // Add to toasts for floating UI
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Log helper (all calls are user-initiated → auto-notify) ───────────────
  const addSystemLog = (type, detailsOrMsg, ipOrReason = '-', serviceOrSession = '-') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newLog = { id: Date.now(), time: timeStr, type };

    if (type === 'SYSTEM')      { newLog.message = detailsOrMsg; }
    else if (type === 'AUTH')   { newLog.user = detailsOrMsg; newLog.ip = ipOrReason; newLog.service = serviceOrSession; }
    else if (type === 'REJECT') { newLog.user = detailsOrMsg; newLog.reason = detailsOrMsg.includes('Isolir') ? 'Isolir Aktif' : ipOrReason; newLog.ip = detailsOrMsg.includes('Isolir') ? ipOrReason : '192.168.1.99'; }
    else if (type === 'ACCT')   { newLog.action = detailsOrMsg.split(':')[0] || 'Update'; newLog.user = detailsOrMsg.split(' ').pop(); newLog.session = ipOrReason; }

    setLogs(prev => [newLog, ...prev.slice(0, 49)]);

    // Auto-generate notification for every user-initiated action
    const variant = type === 'REJECT' ? 'warning' : type === 'AUTH' ? 'success' : 'info';
    addNotification(detailsOrMsg, variant);
  };

  const clearLogs = () => setLogs([]);

  // ── Clock ticker ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Simulated periodic FreeRADIUS log ─────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (radiusStatus !== 'Connected') return;
      const r = Math.random();
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const log = { id: Date.now(), time: timeStr };

      if (r < 0.45) {
        log.type = 'AUTH'; log.user = 'user_' + Math.floor(Math.random() * 9000 + 1000); log.ip = '192.168.1.' + Math.floor(Math.random() * 100 + 20); log.service = 'Hotspot';
      } else if (r < 0.75) {
        const users = ['router_ahmad', 'router_ratna', 'budi_san', 'rian_h'];
        log.type = 'ACCT'; log.action = 'Alive Update'; log.user = users[Math.floor(Math.random() * users.length)]; log.session = Math.floor(Math.random() * 900000 + 100000).toString(16).toUpperCase();
      } else {
        log.type = 'REJECT'; log.user = 'guest_' + Math.floor(Math.random() * 100); log.reason = 'Password Expired / Invalid'; log.ip = '192.168.1.' + Math.floor(Math.random() * 100 + 20);
      }
      // Direct setLogs – NOT through addSystemLog (avoid notification flood)
      setLogs(prev => [log, ...prev.slice(0, 49)]);
    }, 8000);
    return () => clearInterval(timer);
  }, [radiusStatus]);

  // ── localStorage persistence ──────────────────────────────────────────────
  useEffect(() => { saveState('packages', packages); }, [packages]);
  useEffect(() => { saveState('vouchers', vouchers); }, [vouchers]);
  useEffect(() => { saveState('members', members); }, [members]);
  useEffect(() => { saveState('routers', routers); }, [routers]);

  // ── Sync server handler ───────────────────────────────────────────────────
  const handleSyncServer = () => {
    setRadiusStatus('Syncing');
    addSystemLog('SYSTEM', 'Sinkronisasi profil & billing ke FreeRADIUS Server dimulai...');
    setTimeout(() => {
      setRadiusStatus('Connected');
      addSystemLog('SYSTEM', 'Sinkronisasi Selesai. Database tersinkronisasi.');
    }, 1500);
  };

  // ── Reset data (clear localStorage) ───────────────────────────────────────
  const handleResetData = () => {
    if (!window.confirm('Reset semua data ke default? Data saat ini akan dihapus.')) return;
    ['packages', 'vouchers', 'members', 'routers'].forEach(k => localStorage.removeItem(`rtrwnet_${k}`));
    setPackages(defaultPackages());
    setVouchers(defaultVouchers());
    setMembers(defaultMembers());
    setRouters(defaultRouters());
    setNotifications([]);
    addNotification('Data berhasil direset ke default.', 'info');
  };

  // ── Global search computation ─────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    packages.filter(p => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)).forEach(p =>
      results.push({ id: `pkg-${p.id}`, label: p.name, sub: `${p.type} · Rp ${p.price.toLocaleString('id-ID')}`, tab: 'packages', icon: 'inventory_2' })
    );
    vouchers.filter(v => v.code.toLowerCase().includes(q) || v.package.toLowerCase().includes(q)).forEach(v =>
      results.push({ id: `vch-${v.id}`, label: v.code, sub: `${v.package} · ${v.status}`, tab: 'log', icon: 'confirmation_number' })
    );
    members.filter(m => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q) || m.phone.includes(q)).forEach(m =>
      results.push({ id: `mem-${m.id}`, label: m.name, sub: `@${m.username} · ${m.phone}`, tab: 'members', icon: 'person' })
    );
    routers.filter(r => r.customerName.toLowerCase().includes(q) || r.pppoeUser.toLowerCase().includes(q) || r.routerIp.includes(q)).forEach(r =>
      results.push({ id: `rtr-${r.id}`, label: r.customerName, sub: `@${r.pppoeUser} · ${r.routerIp}`, tab: 'routers', icon: 'router' })
    );
    return results.slice(0, 12);
  }, [searchQuery, packages, vouchers, members, routers]);

  const handleSearchSelect = (result) => {
    setActiveTab(result.tab);
    setSearchQuery('');
    setSearchOpen(false);
  };

  // ── Nav definitions ───────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard', name: 'Dashboard Overview', icon: 'dashboard', section: 'core' },
    { id: 'packages', name: 'Pengelolaan Paket & Bandwidth', icon: 'inventory_2', section: 'core' },
    { id: 'generator', name: 'Generator Voucher', icon: 'confirmation_number', section: 'voucher' },
    { id: 'log', name: 'Log Voucher Aktif', icon: 'history', section: 'voucher' },
    { id: 'members', name: 'Daftar Member', icon: 'group', section: 'member' },
    { id: 'sessions', name: 'Status Sesi Browser', icon: 'sensors', section: 'member' },
    { id: 'routers', name: 'Daftar Router Rumah', icon: 'router', section: 'pppoe' },
    { id: 'monitoring', name: 'Monitoring & Isolir', icon: 'analytics', section: 'pppoe' },
  ];

  const sectionLabels = {
    core: 'Core Settings',
    voucher: 'Voucher Hotspot (Eceran)',
    member: 'Member Hotspot (Bulanan Web)',
    pppoe: 'Koneksi PPPoE (Bulanan Router)',
  };

  const renderActiveComponent = () => {
    const commonProps = { addSystemLog, requestConfirm, addNotification };
    const isSyncing = radiusStatus === 'Syncing';
    switch (activeTab) {
      case 'dashboard':  return <DashboardOverview packages={packages} vouchers={vouchers} members={members} routers={routers} logs={logs} clearLogs={clearLogs} isSyncing={isSyncing} {...commonProps} />;
      case 'packages':   return <PackageManagement packages={packages} setPackages={setPackages} {...commonProps} />;
      case 'generator':  return <VoucherGenerator packages={packages} vouchers={vouchers} setVouchers={setVouchers} {...commonProps} />;
      case 'log':        return <ActiveVoucherLog vouchers={vouchers} setVouchers={setVouchers} {...commonProps} />;
      case 'members':    return <MemberList members={members} setMembers={setMembers} packages={packages} {...commonProps} />;
      case 'sessions':   return <BrowserSessions members={members} setMembers={setMembers} {...commonProps} />;
      case 'routers':    return <RouterList routers={routers} setRouters={setRouters} packages={packages} {...commonProps} />;
      case 'monitoring': return <MonitoringIsolir routers={routers} setRouters={setRouters} {...commonProps} />;
      default:           return <DashboardOverview packages={packages} vouchers={vouchers} members={members} routers={routers} logs={logs} clearLogs={clearLogs} isSyncing={isSyncing} {...commonProps} />;
    }
  };

  const getPageTitle = () => (tabs.find(t => t.id === activeTab)?.name ?? 'Billing Dashboard');

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex w-full bg-background text-on-surface">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <nav className={`fixed left-0 top-0 h-full w-sidebar-width bg-on-secondary-fixed text-slate-100 flex flex-col py-6 px-2 z-40 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand */}
        <div className="mb-6 px-4 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary font-bold shadow-md">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>router</span>
          </div>
          <div>
            <h1 className="font-headline-md text-[20px] font-bold text-white tracking-tight">RT/RW NET</h1>
            <p className="font-label-sm text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Billing System</p>
          </div>
        </div>

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto space-y-5 px-2 select-none">
          {Object.entries(sectionLabels).map(([section, label]) => (
            <div key={section}>
              <p className="px-3 text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-2">{label}</p>
              <ul className="space-y-1">
                {tabs.filter(t => t.section === section).map(tab => (
                  <li key={tab.id}>
                    <button
                      onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                      aria-label={tab.name}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative font-label-md text-left ${activeTab === tab.id ? 'bg-primary text-white font-semibold shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                      {tab.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer: Sync + Settings + Logout */}
        <div className="mt-auto px-4 pt-4 border-t border-slate-800 space-y-3">
          <button onClick={handleSyncServer} disabled={radiusStatus === 'Syncing'} className="w-full py-2.5 px-4 bg-[#006e4b] hover:opacity-90 disabled:opacity-50 text-white font-label-md text-label-md rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95">
            <span className={`material-symbols-outlined text-[18px] ${radiusStatus === 'Syncing' ? 'animate-spin' : ''}`}>sync</span>
            {radiusStatus === 'Syncing' ? 'Syncing...' : 'Sync Server'}
          </button>
          <div className="h-px bg-slate-800 w-full"></div>
          <ul className="space-y-1">
            <li><button onClick={handleResetData} className="w-full flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/40 transition-all font-label-md text-label-md text-left"><span className="material-symbols-outlined">settings_backup_restore</span>Reset Data</button></li>
            <li><button onClick={() => alert("Pengaturan Sistem FreeRADIUS & Mikrotik API...")} className="w-full flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/40 transition-all font-label-md text-label-md text-left"><span className="material-symbols-outlined">settings</span>Settings</button></li>
            <li><button onClick={() => { if (confirm("Logout dari Dashboard?")) alert("Logout berhasil!"); }} className="w-full flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/40 transition-all font-label-md text-label-md text-left"><span className="material-symbols-outlined">logout</span>Logout</button></li>
          </ul>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm" />}

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-[280px] min-h-screen flex flex-col overflow-x-hidden">

        {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
        <header className="bg-surface border-b border-surface-variant shadow-sm w-full h-16 flex justify-between items-center px-6 sticky top-0 z-20">

          {/* Left: Hamburger + Search */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)} 
              className="md:hidden text-slate-700 hover:text-black hover:bg-slate-100 p-1.5 rounded-lg transition-colors active:scale-95"
              aria-label="Buka menu sidebar"
              aria-expanded={mobileMenuOpen}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            {/* Global Search */}
            <div className={`relative ${mobileSearchOpen ? 'absolute inset-0 bg-surface z-50 flex items-center px-4 w-full h-full' : 'hidden'} sm:block sm:static sm:bg-transparent sm:w-auto sm:p-0`}>
              {mobileSearchOpen && (
                <button 
                  onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }} 
                  className="sm:hidden mr-3 text-on-surface-variant p-2 rounded-full hover:bg-surface-container"
                  aria-label="Tutup pencarian"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
              )}
              <span className={`material-symbols-outlined absolute ${mobileSearchOpen ? 'left-14' : 'left-3'} sm:left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none`}>search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                placeholder="Cari paket, voucher, member, router..."
                aria-label="Cari global"
                className={`pl-10 pr-4 py-2 bg-surface-container-low border border-surface-variant rounded-full text-[13px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${mobileSearchOpen ? 'w-full' : 'w-72'}`}
              />

              {/* Search Results Dropdown */}
              {searchOpen && searchQuery.trim() && (
                <div className={`absolute top-full left-0 mt-1.5 bg-surface-container-lowest border border-surface-variant rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50 ${mobileSearchOpen ? 'w-[calc(100vw-32px)] left-4' : 'w-96'}`}>
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-outline italic">Tidak ditemukan hasil untuk "{searchQuery}"</div>
                  ) : (
                    <div className="py-1">
                      {searchResults.map(r => (
                        <button
                          key={r.id}
                          onMouseDown={(e) => { e.preventDefault(); handleSearchSelect(r); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px] text-primary/60">{r.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{r.label}</p>
                            <p className="text-[11px] text-slate-400 truncate">{r.sub}</p>
                          </div>
                          <span className="material-symbols-outlined text-[16px] text-slate-300">arrow_forward</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Clock · Notifications · RADIUS · Profile */}
          <div className="flex items-center gap-3 md:gap-4 ml-auto">

            {/* Digital Clock */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-full font-mono text-[12px] font-bold">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              {currentTime || '00:00:00'}
            </div>
            
            {/* Mobile Search Toggle */}
            <button 
              onClick={() => { setMobileSearchOpen(true); setTimeout(() => document.querySelector('input[aria-label="Cari global"]')?.focus(), 100); }}
              className="sm:hidden w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95"
              aria-label="Buka pencarian"
              aria-expanded={mobileSearchOpen}
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95"
              title="Toggle Dark Mode"
              aria-label={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllNotificationsRead(); }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors relative active:scale-95"
                aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} pesan belum dibaca` : ''}`}
                aria-expanded={notifOpen}
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div onClick={() => setNotifOpen(false)} className="fixed inset-0 z-30" />
                  <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-surface-variant rounded-xl shadow-2xl z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
                      <h3 className="font-bold text-sm text-slate-800">Notifikasi</h3>
                      {notifications.length > 0 && (
                        <button onClick={() => setNotifications([])} className="text-[11px] text-primary hover:underline">
                          Hapus semua
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-72">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400 italic">
                          <span className="material-symbols-outlined text-[28px] text-slate-300 block mb-1">notifications_off</span>
                          Belum ada notifikasi
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${!n.read ? 'bg-primary-fixed/5 border-l-2 border-l-primary' : ''}`}>
                            <div className="flex items-start gap-2">
                              <span className={`material-symbols-outlined text-[16px] mt-0.5 ${n.variant === 'warning' ? 'text-amber-500' : n.variant === 'success' ? 'text-green-600' : n.variant === 'error' ? 'text-red-500' : 'text-primary'}`}>
                                {n.variant === 'warning' ? 'warning' : n.variant === 'success' ? 'check_circle' : n.variant === 'error' ? 'error' : 'info'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-slate-700 leading-snug">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-mono">{n.time}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-200"></div>

            {/* RADIUS Status Badge */}
            <button 
              onClick={handleSyncServer} 
              title="Status FreeRADIUS (klik sync)" 
              aria-label={`Status Server: ${radiusStatus}. Klik untuk sinkronisasi.`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors active:scale-95"
            >
              <span className={`w-2 h-2 rounded-full ${radiusStatus === 'Connected' ? 'bg-[#006e4b] animate-pulse' : radiusStatus === 'Syncing' ? 'bg-amber-500 animate-spin' : 'bg-red-600 animate-ping'}`}></span>
              <span className="font-mono text-[11px] font-bold text-on-surface-variant uppercase">RADIUS: {radiusStatus}</span>
            </button>

            <div className="hidden sm:block h-6 w-px bg-surface-variant"></div>

            {/* Admin Profile */}
            <div className="relative">
              <button 
                onClick={() => setAdminOpen(!adminOpen)} 
                className="flex items-center gap-3 cursor-pointer hover:bg-surface-container-low p-1.5 rounded-lg transition-all"
                aria-label="Buka menu admin"
                aria-expanded={adminOpen}
              >
                <div className="text-right hidden md:block">
                  <p className="font-label-md text-label-md text-slate-800 font-bold">Administrator</p>
                  <p className="font-label-sm text-[10px] text-slate-500 uppercase font-semibold">Admin Utama</p>
                </div>
                <img alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-slate-300" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCs16YTETo39TNgbJjNRa1OcXQjSJrKWYfODPTE-Nau9XO3SJGQy4OdL00PamcsP_VUOR2WGDdgjJ7YO58w057tCkWMfZRj6JzSn4_baeqIZhR_8uUwRX7-kr4kdViGBPMPoQfc76T7-l3zfZT7mJMpfqsluBCBB5UaTdgCby9nUcPxdaQa96wHeVPmPrv8YMagdOdQke2qnQCrFH5IW3Yv2Sagn-p8XXJdzrh1kul6umEJNo4Zl3yzguiaR-hec17so65SqMSR4C8" />
              </button>
              {adminOpen && (
                <>
                  <div onClick={() => setAdminOpen(false)} className="fixed inset-0 z-10" />
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-surface-variant rounded-lg shadow-xl py-2 z-20 animate-slideIn">
                    <div className="px-4 py-2 border-b border-surface-variant"><p className="text-xs font-semibold text-outline uppercase">Manage</p></div>
                    <button onClick={() => { setAdminOpen(false); alert("Profil Admin..."); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">account_circle</span>Profil Admin</button>
                    <button onClick={() => { setAdminOpen(false); handleSyncServer(); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">sync</span>RADIUS Sync</button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button onClick={() => { setAdminOpen(false); handleResetData(); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">settings_backup_restore</span>Reset Data</button>
                    <button onClick={() => { setAdminOpen(false); if (confirm("Logout?")) alert("Logout!"); }} className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/10 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">logout</span>Keluar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── WORKSPACE CANVAS ────────────────────────────────────────────── */}
        <main className="flex-1 p-6 max-w-container-max mx-auto w-full print:p-0 print:m-0 overflow-x-hidden">
          <div key={activeTab} className="animate-slideIn">
            {renderActiveComponent()}
          </div>
        </main>

        <footer className="py-4 border-t border-surface-variant text-center text-label-sm text-outline print:hidden bg-surface-container-lowest">
          <p>© 2026 RT/RW NET Billing System · FreeRADIUS & Mikrotik API · Data tersimpan di browser (localStorage)</p>
        </footer>
        {/* Toast Notifications Container */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] border animate-slideIn ${
              t.variant === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 
              t.variant === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
              t.variant === 'error' ? 'bg-[#FFDAD6] border-[#FFB4AB] text-[#410002]' : 
              'bg-[#E0E0FF] border-[#BFC2FF] text-[#19144C]'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {t.variant === 'warning' ? 'warning' : t.variant === 'success' ? 'check_circle' : t.variant === 'error' ? 'error' : 'info'}
              </span>
              <p className="font-label-md text-[13px]">{t.message}</p>
            </div>
          ))}
        </div>

        {/* Global Confirm Modal */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-slideIn flex flex-col border border-surface-variant">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${confirmDialog.variant === 'danger' ? 'bg-error-container text-error' : 'bg-primary/10 text-primary'}`}>
                    <span className="material-symbols-outlined text-[24px]">
                      {confirmDialog.variant === 'danger' ? 'warning' : 'help'}
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-[18px] font-bold text-slate-800">{confirmDialog.title}</h3>
                </div>
                <p className="text-body-md text-slate-600 mb-6">{confirmDialog.message}</p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={closeConfirm}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-label-md text-sm font-semibold"
                  >
                    {confirmDialog.cancelText}
                  </button>
                  <button 
                    onClick={() => {
                      if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                      closeConfirm();
                    }}
                    className={`px-5 py-2 rounded-lg text-white transition-colors font-label-md text-sm font-semibold shadow-sm ${confirmDialog.variant === 'danger' ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary-container'}`}
                  >
                    {confirmDialog.confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
