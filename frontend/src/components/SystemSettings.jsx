import React, { useState, useEffect } from 'react';

export default function SystemSettings({ addNotification }) {
  const [activeTab, setActiveTab] = useState('freeradius');

  // Form states
  const [radiusConfig, setRadiusConfig] = useState({
    host: '127.0.0.1',
    port: '1812',
    dbUser: 'radius',
    dbPass: 'radpass',
    secret: 'testing123',
    staleTimeout: '15'
  });

  const [mikrotikConfig, setMikrotikConfig] = useState({
    host: '192.168.88.1',
    port: '8728',
    apiUser: 'admin',
    apiPass: ''
  });

  const [appPreferences, setAppPreferences] = useState({
    theme: 'system',
    language: 'id',
    autoSync: '30'
  });

  const [customMessages, setCustomMessages] = useState({
    voucherExpired: 'Maaf, Voucher Anda telah Habis/Kedaluwarsa.',
    macLocked: 'Maaf, Voucher ini sudah terkunci di perangkat lain.',
    invalidVoucher: 'Maaf, Voucher tidak ditemukan atau salah ketik.'
  });

  // Load from backend on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const data = json.data;
          if (data.radius_host) {
            setRadiusConfig({
              host: data.radius_host || '127.0.0.1',
              port: data.radius_port || '5432',
              dbUser: data.radius_user || 'radius',
              dbPass: data.radius_pass || 'radpass',
              secret: data.radius_secret || 'testing123',
              staleTimeout: data.stale_session_timeout_minutes || '15'
            });
          }
          if (data.mikrotik_host) {
            setMikrotikConfig({
              host: data.mikrotik_host || '192.168.88.1',
              port: data.mikrotik_port || '8728',
              apiUser: data.mikrotik_user || 'admin',
              apiPass: data.mikrotik_pass || ''
            });
          }
          setAppPreferences({
            theme: data.app_prefs_theme || 'system',
            language: data.app_prefs_lang || 'id',
            autoSync: data.auto_sync_interval || '30'
          });
          setCustomMessages({
            voucherExpired: data.msg_voucher_expired || 'Maaf, Voucher Anda telah Habis/Kedaluwarsa.',
            macLocked: data.msg_mac_locked || 'Maaf, Voucher ini sudah terkunci di perangkat lain.',
            invalidVoucher: data.msg_invalid_voucher || 'Maaf, Voucher tidak ditemukan atau salah ketik.'
          });
        }
      })
      .catch(err => console.error('Error fetching settings:', err));
  }, []);

  const handleSave = () => {
    const payload = {
      radius_host: radiusConfig.host,
      radius_port: radiusConfig.port,
      radius_user: radiusConfig.dbUser,
      radius_pass: radiusConfig.dbPass,
      radius_secret: radiusConfig.secret,
      stale_session_timeout_minutes: radiusConfig.staleTimeout,
      
      mikrotik_host: mikrotikConfig.host,
      mikrotik_port: mikrotikConfig.port,
      mikrotik_user: mikrotikConfig.apiUser,
      mikrotik_pass: mikrotikConfig.apiPass,
      
      app_prefs_theme: appPreferences.theme,
      app_prefs_lang: appPreferences.language,
      auto_sync_interval: appPreferences.autoSync,
      
      msg_voucher_expired: customMessages.voucherExpired,
      msg_mac_locked: customMessages.macLocked,
      msg_invalid_voucher: customMessages.invalidVoucher
    };
    
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        addNotification('Pengaturan sistem berhasil disimpan.', 'success');
      } else {
        addNotification('Gagal menyimpan pengaturan: ' + json.message, 'error');
      }
    })
    .catch(err => {
      addNotification('Gagal menyimpan pengaturan: ' + err.message, 'error');
    });
  };

  const handleTestConnection = (type) => {
    addNotification(`Menguji koneksi ke ${type}...`, 'info');
    
    let apiPath = '';
    let payload = {};
    if (type === 'Database FreeRADIUS') {
      apiPath = '/api/settings/test-radius';
      payload = radiusConfig;
    } else {
      apiPath = '/api/settings/test-mikrotik';
      payload = { host: mikrotikConfig.host, port: mikrotikConfig.port };
    }
    
    fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        addNotification(json.message, 'success');
      } else {
        addNotification(json.message || 'Koneksi gagal', 'error');
      }
    })
    .catch(err => {
      addNotification(`Gagal menguji koneksi: ${err.message}`, 'error');
    });
  };

  const handleSetupIsolir = () => {
    const appIp = prompt('Masukkan IP Server Aplikasi Billing ini (IP lokal/publik yang akan diakses pengguna saat diisolir):', '192.168.1.10');
    if (!appIp) return;
    
    addNotification('Sedang menyuntikkan NAT Isolir ke MikroTik...', 'info');
    fetch('/api/settings/mikrotik/setup-isolir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_ip: appIp })
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        addNotification(json.message, 'success');
      } else {
        addNotification('Gagal: ' + json.message, 'error');
      }
    })
    .catch(err => {
      addNotification(`Gagal mengatur Isolir: ${err.message}`, 'error');
    });
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Pengaturan Sistem</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Konfigurasi server FreeRADIUS, integrasi Mikrotik API, dan preferensi aplikasi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Settings Navigation */}
        <div className="lg:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('freeradius')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-label-md text-left ${activeTab === 'freeradius' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[20px]">dns</span>
            Server FreeRADIUS
          </button>
          <button 
            onClick={() => setActiveTab('mikrotik')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-label-md text-left ${activeTab === 'mikrotik' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[20px]">router</span>
            Mikrotik API
          </button>
          <button 
            onClick={() => setActiveTab('preferences')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-label-md text-left ${activeTab === 'preferences' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
            Preferensi Aplikasi
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-label-md text-left ${activeTab === 'messages' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Pesan Kustom
          </button>
        </div>

        {/* Settings Form Content */}
        <div className="lg:col-span-3">
          <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-sm p-6">
            
            {/* FreeRADIUS Settings */}
            {activeTab === 'freeradius' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-surface-variant pb-4 mb-4">
                  <h3 className="font-title-md text-title-md text-on-surface">Koneksi Database FreeRADIUS</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">Kredensial database MySQL/MariaDB yang digunakan oleh FreeRADIUS.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Database Host</label>
                    <input 
                      type="text" 
                      value={radiusConfig.host}
                      onChange={(e) => setRadiusConfig({...radiusConfig, host: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Database Port</label>
                    <input 
                      type="text" 
                      value={radiusConfig.port}
                      onChange={(e) => setRadiusConfig({...radiusConfig, port: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Database User</label>
                    <input 
                      type="text" 
                      value={radiusConfig.dbUser}
                      onChange={(e) => setRadiusConfig({...radiusConfig, dbUser: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Database Password</label>
                    <input 
                      type="password" 
                      value={radiusConfig.dbPass}
                      onChange={(e) => setRadiusConfig({...radiusConfig, dbPass: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[13px] font-semibold text-on-surface">RADIUS Secret Key</label>
                    <input 
                      type="password" 
                      value={radiusConfig.secret}
                      onChange={(e) => setRadiusConfig({...radiusConfig, secret: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-[11px] text-on-surface-variant">Shared secret yang dikonfigurasi di clients.conf</p>
                  </div>
                  
                  <div className="space-y-1.5 md:col-span-2 border-t border-surface-variant pt-4 mt-2">
                    <label className="text-[13px] font-semibold text-on-surface">Pembersihan Sesi Otomatis (Stale Session Timeout)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={radiusConfig.staleTimeout}
                        onChange={(e) => setRadiusConfig({...radiusConfig, staleTimeout: e.target.value})}
                        className="w-24 px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-[13px] text-on-surface-variant">Menit</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">Durasi tunggu sebelum sistem memutus otomatis sesi yang menggantung tanpa adanya laporan (Interim-Update) dari Mikrotik. Set 0 untuk menonaktifkan.</p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button onClick={() => handleTestConnection('Database FreeRADIUS')} className="px-4 py-2 text-primary hover:bg-primary/10 rounded-lg transition-colors font-label-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                    Test Koneksi
                  </button>
                  <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg transition-colors font-label-md shadow-sm">
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            )}

            {/* Mikrotik Settings */}
            {activeTab === 'mikrotik' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-surface-variant pb-4 mb-4">
                  <h3 className="font-title-md text-title-md text-on-surface">Integrasi Mikrotik API</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">Konfigurasi untuk komunikasi langsung dengan RouterBoard via API (untuk Kick User, Cek Interfaces).</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Router IP / Host</label>
                    <input 
                      type="text" 
                      value={mikrotikConfig.host}
                      onChange={(e) => setMikrotikConfig({...mikrotikConfig, host: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">API Port</label>
                    <input 
                      type="text" 
                      value={mikrotikConfig.port}
                      onChange={(e) => setMikrotikConfig({...mikrotikConfig, port: e.target.value})}
                      placeholder="8728 (atau 8729 untuk SSL)"
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[13px] font-semibold text-on-surface">API Username</label>
                    <input 
                      type="text" 
                      value={mikrotikConfig.apiUser}
                      onChange={(e) => setMikrotikConfig({...mikrotikConfig, apiUser: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[13px] font-semibold text-on-surface">API Password</label>
                    <input 
                      type="password" 
                      value={mikrotikConfig.apiPass}
                      onChange={(e) => setMikrotikConfig({...mikrotikConfig, apiPass: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-mono text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-surface-variant mt-2">
                  <div className="flex gap-3">
                    <button onClick={() => handleTestConnection('Mikrotik API')} className="px-4 py-2 text-primary hover:bg-primary/10 rounded-lg transition-colors font-label-md flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">wifi_tethering</span>
                      Test Koneksi
                    </button>
                    <button onClick={handleSetupIsolir} className="px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-colors font-label-md flex items-center gap-2" title="Injeksi Rule Redirect Firewall NAT secara otomatis">
                      <span className="material-symbols-outlined text-[18px]">security</span>
                      Setup Isolir Rule (NAT)
                    </button>
                  </div>
                  <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg transition-colors font-label-md shadow-sm">
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            )}

            {/* Application Preferences */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-surface-variant pb-4 mb-4">
                  <h3 className="font-title-md text-title-md text-on-surface">Preferensi Dashboard</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">Pengaturan antarmuka dan perilaku aplikasi Billing.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Tema Tampilan</label>
                    <select 
                      value={appPreferences.theme}
                      onChange={(e) => setAppPreferences({...appPreferences, theme: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="system">Mengikuti Sistem (Auto)</option>
                      <option value="light">Mode Terang (Light)</option>
                      <option value="dark">Mode Gelap (Dark)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Bahasa Dashboard</label>
                    <select 
                      value={appPreferences.language}
                      onChange={(e) => setAppPreferences({...appPreferences, language: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[13px] font-semibold text-on-surface">Interval Auto-Sync Background (Detik)</label>
                    <div className="flex gap-4">
                      {['10', '30', '60', '300'].map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="autosync" 
                            value={val}
                            checked={appPreferences.autoSync === val}
                            onChange={(e) => setAppPreferences({...appPreferences, autoSync: e.target.value})}
                            className="w-4 h-4 text-primary bg-surface-container border-surface-variant focus:ring-primary"
                          />
                          <span className="text-[14px] text-on-surface">{val}s</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-2">Seberapa sering dashboard menarik data terbaru dari server di latar belakang.</p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end">
                  <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg transition-colors font-label-md shadow-sm">
                    Simpan Preferensi
                  </button>
                </div>
              </div>
            )}

            {/* Custom Messages Settings */}
            {activeTab === 'messages' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-surface-variant pb-4 mb-4">
                  <h3 className="font-title-md text-title-md text-on-surface">Pesan Penolakan (Custom Reject Messages)</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">Pesan yang ditampilkan di halaman login Mikrotik ketika akses voucher ditolak.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Pesan: Voucher Kedaluwarsa / Kuota Habis</label>
                    <input 
                      type="text" 
                      value={customMessages.voucherExpired}
                      onChange={(e) => setCustomMessages({...customMessages, voucherExpired: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-[11px] text-on-surface-variant">Ditampilkan ketika masa aktif atau batas kuota voucher telah tercapai.</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Pesan: MAC Address Terkunci (Device Beda)</label>
                    <input 
                      type="text" 
                      value={customMessages.macLocked}
                      onChange={(e) => setCustomMessages({...customMessages, macLocked: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-[11px] text-on-surface-variant">Ditampilkan ketika seseorang mencoba menggunakan voucher yang sudah terikat dengan perangkat lain (jika MAC Binding aktif).</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-on-surface">Pesan: Voucher Tidak Ditemukan / Salah</label>
                    <input 
                      type="text" 
                      value={customMessages.invalidVoucher}
                      onChange={(e) => setCustomMessages({...customMessages, invalidVoucher: e.target.value})}
                      className="w-full px-4 py-2 bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-[11px] text-on-surface-variant">Ditampilkan ketika pengguna salah mengetik kode voucher atau voucher memang tidak ada di database.</p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end">
                  <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg transition-colors font-label-md shadow-sm">
                    Simpan Pesan
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
