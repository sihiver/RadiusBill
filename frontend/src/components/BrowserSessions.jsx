import React, { useState, useEffect } from 'react';

const formatUptime = (ms) => {
  if (!ms || ms < 0) return '-- --';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')} Jam ${String(m).padStart(2,'0')} Mnt ${String(s).padStart(2,'0')} Dtk`;
};

export default function BrowserSessions({ members, setMembers, addSystemLog }) {
  const [search, setSearch] = useState('');
  const [, setTick] = useState(0);
  const [trafficData, setTrafficData] = useState({});

  // Tick every 1s to force re-render for uptime counters
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Randomize traffic data every 2.5s
  useEffect(() => {
    const generateTraffic = () => {
      const data = {};
      members.filter(m => m.activeSession).forEach(m => {
        data[m.id] = {
          rx: (Math.random() * (3.5 - 0.2) + 0.2).toFixed(1) + ' GB',
          tx: (Math.floor(Math.random() * (900 - 100 + 1)) + 100) + ' MB',
        };
      });
      setTrafficData(data);
    };
    generateTraffic();
    const interval = setInterval(generateTraffic, 2500);
    return () => clearInterval(interval);
  }, [members]);

  // Compute live totals for stat cards
  const totalDownload = Object.values(trafficData).reduce((sum, t) => sum + parseFloat(t.rx), 0).toFixed(1);
  const totalUpload = (Object.values(trafficData).reduce((sum, t) => sum + parseInt(t.tx), 0) / 1000).toFixed(1);

  // Get only members with active sessions
  const activeSessions = members.filter(m => m.activeSession);

  const handleDisconnect = (id, name, username) => {
    if (window.confirm(`Apakah Anda yakin ingin memutuskan sesi browser untuk @${username}?`)) {
      setMembers(members.map(m => m.id === id ? {
        ...m,
        activeSession: false,
        ipAddress: '-',
        sessionStartedAt: undefined
      } : m));

      addSystemLog('ACCT', `Stop: Logout browser session untuk @${username} (${name})`, '99C128', '192.168.1.120');
    }
  };

  const filteredSessions = activeSessions.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.username.toLowerCase().includes(search.toLowerCase()) || 
    (m.ipAddress && m.ipAddress.includes(search))
  );

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Status Sesi Browser</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Daftar pengguna terautentikasi portal web captive portal saat ini. Monitor sesi aktif dan putuskan koneksi browser secara real-time.</p>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">sensors</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Sesi Browser Aktif</p>
            <p className="font-display-lg text-[22px] font-bold text-on-surface">{activeSessions.length} Online</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
            <span className="material-symbols-outlined">download</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Total Download (Live)</p>
            <p className="font-display-lg text-[22px] font-bold text-on-surface">{totalDownload} GB</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined">upload</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Total Upload (Live)</p>
            <p className="font-display-lg text-[22px] font-bold text-on-surface">{totalUpload} GB</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 shadow-[0_1px_3px_rgba(77,68,227,0.03)]">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari nama, username, atau IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-surface-dim rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Browser Sessions List */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4">Pelanggan</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">MAC Address</th>
                <th className="p-4">Paket Sesi</th>
                <th className="p-4">Uptime Sesi</th>
                <th className="p-4">Traffic (DL / UL)</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-on-surface-variant italic">
                    Tidak ada sesi browser portal yang sedang aktif saat ini.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                    {/* User profile */}
                    <td className="p-4">
                      <div className="font-bold text-on-surface">{session.name}</div>
                      <div className="text-[11px] text-primary font-mono">@{session.username}</div>
                    </td>

                    {/* IP */}
                    <td className="p-4 font-mono font-semibold text-on-surface-variant">
                      {session.ipAddress}
                    </td>

                    {/* MAC */}
                    <td className="p-4 font-mono text-outline">
                      {/* Simulated MAC Address based on id */}
                      {`A4:3E:45:C2:08:${session.id.toString(16).padStart(2, '0').toUpperCase()}`}
                    </td>

                    {/* Package */}
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                        {session.package}
                      </span>
                    </td>

                    {/* Uptime */}
                    <td className="p-4 font-mono">
                      {session.sessionStartedAt ? formatUptime(Date.now() - session.sessionStartedAt) : '-- --'}
                    </td>

                    {/* Traffic */}
                    <td className="p-4 font-mono">
                      <div className="flex items-center gap-1 text-[12px]">
                        <span className="material-symbols-outlined text-[12px] text-green-600">download</span>
                        {trafficData[session.id]?.rx || '0.0 GB'}
                        <span className="text-[10px] text-outline">/</span>
                        <span className="material-symbols-outlined text-[12px] text-blue-600">upload</span>
                        {trafficData[session.id]?.tx || '0 MB'}
                      </div>
                    </td>

                    {/* Kick Action */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDisconnect(session.id, session.name, session.username)}
                        className="bg-error-container hover:bg-error/20 text-error font-label-sm text-[11px] px-2.5 py-1 rounded transition-colors active:scale-95"
                      >
                        Disconnect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
