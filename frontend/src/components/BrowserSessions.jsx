import React, { useState, useEffect } from 'react';

export default function BrowserSessions({ members, setMembers, fetchMembers, vouchers, routers, addSystemLog }) {
  const [search, setSearch] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to format bytes
  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) return '0 MB';
    const num = Number(bytes);
    if (isNaN(num) || num === 0) return '0 MB';
    if (num < 1024) return num + ' B';
    if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB';
    if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(1) + ' MB';
    return (num / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatUptime = (startedAt) => {
    if (!startedAt) return '-- --';
    const elapsedMs = Date.now() - new Date(startedAt).getTime();
    const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2,'0')} Jam ${String(m).padStart(2,'0')} Mnt ${String(s).padStart(2,'0')} Dtk`;
  };

  const fetchActiveSessions = () => {
    fetch('/api/radius/sessions')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const mapped = json.data.map(s => {
            const member = members.find(m => m.username === s.username);
            const voucher = vouchers?.find(v => v.code === s.username);
            const router = routers?.find(r => r.pppoeUser === s.username);

            let name = s.username;
            let pkg = '-';

            if (member) {
              name = member.name;
              pkg = member.package;
            } else if (voucher) {
              name = `Voucher: ${voucher.code}`;
              pkg = voucher.package;
            } else if (router) {
              name = router.customerName;
              pkg = router.package;
            } else {
              name = s.username.startsWith('RW-') ? 'Voucher Guest' : 'Pelanggan PPPoE';
              pkg = s.username.startsWith('RW-') ? 'Voucher' : 'PPPoE';
            }

            return {
              id: s.radacctid,
              name,
              username: s.username,
              ipAddress: s.ip_address,
              macAddress: s.mac_address || '-',
              package: pkg,
              startedAt: s.started_at,
              inputOctets: s.input_octets,
              outputOctets: s.output_octets,
              totalBytes: s.total_bytes
            };
          });
          setActiveSessions(mapped);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load active sessions:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 5000);
    return () => clearInterval(interval);
  }, [members]);

  // Uptime tick counter to force re-render every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute live totals for stat cards
  const totalDownloadBytes = activeSessions.reduce((sum, s) => sum + Number(s.outputOctets || 0), 0);
  const totalUploadBytes = activeSessions.reduce((sum, s) => sum + Number(s.inputOctets || 0), 0);
  const totalDownload = formatBytes(totalDownloadBytes);
  const totalUpload = formatBytes(totalUploadBytes);

  const handleDisconnect = (radacctid, name, username) => {
    if (window.confirm(`Apakah Anda yakin ingin memutuskan sesi browser untuk @${username}?`)) {
      fetch(`/api/radius/sessions/${radacctid}/disconnect`, { method: 'POST' })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            fetchActiveSessions();
            if (fetchMembers) fetchMembers();
            addSystemLog('ACCT', `Stop: Logout browser session untuk @${username} (${name})`, '99C128', '192.168.1.120');
          } else {
            alert(json.message || 'Gagal memutuskan sesi.');
          }
        })
        .catch(err => alert('Error: ' + err.message));
    }
  };

  const filteredSessions = activeSessions.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.username.toLowerCase().includes(search.toLowerCase()) || 
    (s.ipAddress && s.ipAddress.includes(search))
  );

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Status Sesi Browser</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Daftar pengguna terautentikasi captive portal saat ini. Monitor sesi aktif dan putuskan koneksi secara real-time.</p>
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
            <p className="font-display-lg text-[22px] font-bold text-on-surface">{totalDownload}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined">upload</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Total Upload (Live)</p>
            <p className="font-display-lg text-[22px] font-bold text-on-surface">{totalUpload}</p>
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
                    {loading ? 'Memuat data sesi...' : 'Tidak ada sesi browser portal yang sedang aktif saat ini.'}
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
                      {session.macAddress}
                    </td>

                    {/* Package */}
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                        {session.package}
                      </span>
                    </td>

                    {/* Uptime */}
                    <td className="p-4 font-mono">
                      {formatUptime(session.startedAt)}
                    </td>

                    {/* Traffic */}
                    <td className="p-4 font-mono">
                      <div className="flex items-center gap-1 text-[12px]">
                        <span className="material-symbols-outlined text-[12px] text-green-600">download</span>
                        {formatBytes(session.outputOctets)}
                        <span className="text-[10px] text-outline">/</span>
                        <span className="material-symbols-outlined text-[12px] text-blue-600">upload</span>
                        {formatBytes(session.inputOctets)}
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
