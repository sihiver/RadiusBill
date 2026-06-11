import React, { useState, useEffect } from 'react';

export default function MonitoringIsolir({ routers, setRouters, addSystemLog }) {
  const [search, setSearch] = useState('');
  
  // Create state to simulate fluctuating live traffic speeds
  const [trafficSpeeds, setTrafficSpeeds] = useState({});

  useEffect(() => {
    // Set up interval to simulate traffic spikes
    const interval = setInterval(() => {
      const updatedTraffic = {};
      routers.forEach(r => {
        if (r.status === 'Isolated') {
          updatedTraffic[r.id] = { rx: '4 Kbps', tx: '2 Kbps' }; // Limited isolated rate
        } else if (r.status === 'Offline') {
          updatedTraffic[r.id] = { rx: '0 Kbps', tx: '0 Kbps' };
        } else {
          // Generate random speeds
          const rxVal = (Math.random() * 8 + 0.5).toFixed(1); // 0.5 - 8.5 Mbps
          const txVal = (Math.random() * 2 + 0.1).toFixed(1); // 0.1 - 2.1 Mbps
          updatedTraffic[r.id] = { rx: `${rxVal} Mbps`, tx: `${txVal} Mbps` };
        }
      });
      setTrafficSpeeds(updatedTraffic);
    }, 2500);

    return () => clearInterval(interval);
  }, [routers]);

  const handleToggleIsolir = (router) => {
    const isNowIsolated = router.status !== 'Isolated';
    const newStatus = isNowIsolated ? 'Isolated' : 'Online';

    setRouters(routers.map(r => r.id === router.id ? {
      ...r,
      status: newStatus,
      isolir: isNowIsolated
    } : r));

    if (isNowIsolated) {
      addSystemLog('REJECT', `Isolir Aktif: Akun PPPoE @${router.pppoeUser} diblokir (Tunggakan Tagihan)`, 'REJECT-BILL', router.routerIp);
    } else {
      addSystemLog('AUTH', `Isolir Dimatikan: Akun PPPoE @${router.pppoeUser} kembali diaktifkan`, router.routerIp, 'PPPoE');
    }
  };

  const filteredRouters = routers.filter(r => 
    r.customerName.toLowerCase().includes(search.toLowerCase()) || 
    r.pppoeUser.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Monitoring & Isolir PPPoE</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Pantau bandwidth real-time pelanggan PPPoE dan isolasi (blokir) akses internet secara instan.</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
            <span className="material-symbols-outlined">insights</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Online & Monitoring</p>
            <p className="font-display-lg text-[22px] font-bold text-on-surface">
              {routers.filter(r => r.status === 'Online').length} Router
            </p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm border-l-4 border-l-error">
          <div className="w-10 h-10 rounded-lg bg-error-container/10 flex items-center justify-center text-error">
            <span className="material-symbols-outlined">block</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Terisolir (Isolir Tagihan)</p>
            <p className="font-display-lg text-[22px] font-bold text-error">
              {routers.filter(r => r.status === 'Isolated').length} Router
            </p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-600">
            <span className="material-symbols-outlined">router</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Total Terdaftar</p>
            <p className="font-display-lg text-[22px] font-bold text-on-surface">{routers.length} Router</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 shadow-[0_1px_3px_rgba(77,68,227,0.03)]">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari pelanggan atau PPPoE user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-surface-dim rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Monitoring List */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4">Pelanggan Rumah</th>
                <th className="p-4">PPPoE User</th>
                <th className="p-4">Router IP</th>
                <th className="p-4">Paket Sinyal</th>
                <th className="p-4">Traffic RX (Download)</th>
                <th className="p-4">Traffic TX (Upload)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Isolir (Blokir Tagihan)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {filteredRouters.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-on-surface-variant italic">
                    Tidak ada pelanggan PPPoE ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRouters.map((r) => {
                  const currentSpeed = trafficSpeeds[r.id] || { rx: '0 Kbps', tx: '0 Kbps' };
                  
                  return (
                    <tr key={r.id} className={`hover:bg-surface-container-lowest/50 transition-colors ${
                      r.status === 'Isolated' ? 'bg-red-50/30' : ''
                    }`}>
                      {/* Customer Name */}
                      <td className="p-4 font-bold text-on-surface">
                        {r.customerName}
                      </td>

                      {/* PPPoE User */}
                      <td className="p-4 font-mono select-all">
                        @{r.pppoeUser}
                      </td>

                      {/* Router IP */}
                      <td className="p-4 font-mono text-on-surface-variant">
                        {r.routerIp}
                      </td>

                      {/* Package */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded text-[10px] font-bold">
                          {r.package}
                        </span>
                      </td>

                      {/* Traffic RX */}
                      <td className="p-4 font-mono font-semibold">
                        <div className="flex items-center gap-1">
                          <span className={`material-symbols-outlined text-[14px] ${
                            r.status === 'Isolated' ? 'text-error' : r.status === 'Online' ? 'text-green-600' : 'text-outline'
                          }`}>download</span>
                          <span className={r.status === 'Isolated' ? 'text-error' : 'text-on-surface'}>
                            {currentSpeed.rx}
                          </span>
                        </div>
                      </td>

                      {/* Traffic TX */}
                      <td className="p-4 font-mono font-semibold">
                        <div className="flex items-center gap-1">
                          <span className={`material-symbols-outlined text-[14px] ${
                            r.status === 'Isolated' ? 'text-error' : r.status === 'Online' ? 'text-blue-600' : 'text-outline'
                          }`}>upload</span>
                          <span className={r.status === 'Isolated' ? 'text-error' : 'text-on-surface'}>
                            {currentSpeed.tx}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.status === 'Online' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' :
                          r.status === 'Offline' ? 'bg-surface-container-high text-on-surface-variant' :
                          'bg-error-container text-on-error-container animate-pulse'
                        }`}>
                          {r.status === 'Online' ? 'Aktif' : r.status === 'Offline' ? 'Offline' : 'Terisolir'}
                        </span>
                      </td>

                      {/* Isolir Toggle Switch */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={r.status === 'Isolated'}
                              onChange={() => handleToggleIsolir(r)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-surface-container rounded-full peer peer-focus:ring-2 peer-focus:ring-error/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error"></div>
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
