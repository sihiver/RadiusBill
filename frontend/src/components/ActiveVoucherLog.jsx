import React, { useState, useEffect } from 'react';

export default function ActiveVoucherLog({ vouchers, setVouchers, addSystemLog }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Unused', 'Expired'

  // Tick counter to force re-render every second for countdown timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (ms) => {
    if (ms <= 0) return 'Waktu Habis';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} Jam ${m} Mnt ${s} Dtk`;
    if (m > 0) return `${m} Menit ${s} Detik`;
    return `${s} Detik`;
  };

  // Filter vouchers based on search and status select
  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = v.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.package.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDisconnect = (id, code) => {
    if (window.confirm(`Apakah Anda yakin ingin mematikan sesi untuk voucher ${code}?`)) {
      setVouchers(vouchers.map(v => v.id === id ? {
        ...v,
        status: 'Expired',
        ipAddress: '-',
        timeLeft: '0 Sesi Selesai'
      } : v));
      
      addSystemLog('ACCT', `Stop: Sesi voucher ${code} diputus secara paksa oleh Admin`, '88A9B2', '192.168.1.45');
    }
  };

  const handleClearExpired = () => {
    if (window.confirm("Hapus semua voucher yang sudah Expired?")) {
      setVouchers(vouchers.filter(v => v.status !== 'Expired'));
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Log & Daftar Voucher Aktif</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Daftar lengkap voucher, monitoring status aktivasi, dan pemutusan sesi hotspot.</p>
        </div>
        <div className="flex gap-2 self-start sm:self-center">
          <button
            onClick={() => {
              const headers = ['Kode', 'Password', 'Paket', 'Harga', 'Status', 'IP', 'Waktu Aktivasi', 'Pemakaian'];
              const rows = filteredVouchers.map(v => [
                v.code,
                v.password || '',
                v.package,
                v.price,
                v.status,
                v.ipAddress,
                v.activatedTime,
                v.usedBytes
              ].map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(','));
              const csv = [headers.join(','), ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'voucher_log.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="border border-primary text-primary hover:bg-primary/10 font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Export CSV
          </button>
          {vouchers.some(v => v.status === 'Expired') && (
            <button 
              onClick={handleClearExpired}
              className="border border-error text-error hover:bg-error-container/10 font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
              Bersihkan Voucher Expired
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 shadow-[0_1px_3px_rgba(77,68,227,0.03)] flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari kode voucher atau paket..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-surface-dim rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full md:w-auto">
          {['All', 'Active', 'Unused', 'Expired'].map((filter) => {
            const count = filter === 'All' ? vouchers.length : vouchers.filter(v => v.status === filter).length;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
                  statusFilter === filter 
                    ? 'bg-primary text-on-primary shadow-sm' 
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {filter === 'All' ? 'Semua' : filter} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4">Kode Voucher</th>
                <th className="p-4">Paket & Tarif</th>
                <th className="p-4">Status</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Waktu Aktivasi</th>
                <th className="p-4">Pemakaian</th>
                <th className="p-4">Sisa Waktu</th>
                <th className="p-4 text-center">Aksi Sesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-on-surface-variant italic">
                    Tidak ada voucher yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                    {/* Code */}
                    <td className="p-4 font-mono font-bold text-on-surface text-[14px]">
                      {v.code}
                    </td>
                    
                    {/* Package & Price */}
                    <td className="p-4">
                      <div>{v.package}</div>
                      <div className="text-[11px] text-on-surface-variant">Rp {v.price.toLocaleString('id-ID')}</div>
                    </td>
                    
                    {/* Status */}
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        v.status === 'Active' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant animate-pulse' :
                        v.status === 'Unused' ? 'bg-surface-container-high text-on-surface-variant' :
                        'bg-error-container text-on-error-container'
                      }`}>
                        {v.status === 'Active' ? 'Aktif' : v.status === 'Unused' ? 'Belum Dipakai' : 'Expired'}
                      </span>
                    </td>
                    
                    {/* IP */}
                    <td className="p-4 font-mono text-on-surface-variant">
                      {v.ipAddress}
                    </td>
                    
                    {/* Activation Time */}
                    <td className="p-4 text-on-surface-variant">
                      {v.activatedTime}
                    </td>

                    {/* Data Usage */}
                    <td className="p-4 font-mono">
                      {v.usedBytes}
                    </td>
                    
                    {/* Time Left */}
                    <td className="p-4 font-mono font-semibold">
                      {v.expiresAt !== undefined ? (() => {
                        const remaining = v.expiresAt - Date.now();
                        const expired = remaining <= 0 && v.status === 'Active';
                        return (
                          <span className={expired ? 'text-error font-bold' : v.status === 'Active' ? 'text-primary' : 'text-on-surface-variant'}>
                            {formatCountdown(remaining)}
                          </span>
                        );
                      })() : (
                        <span className={v.status === 'Active' ? 'text-primary' : 'text-on-surface-variant'}>
                          {v.timeLeft}
                        </span>
                      )}
                    </td>
                    
                    {/* Disconnect Action */}
                    <td className="p-4 text-center">
                      {v.status === 'Active' ? (
                        <button
                          onClick={() => handleDisconnect(v.id, v.code)}
                          className="bg-error-container hover:bg-error/20 text-error font-label-sm text-[11px] px-2.5 py-1 rounded transition-colors"
                        >
                          Kick
                        </button>
                      ) : (
                        <span className="text-outline text-[11px]">-</span>
                      )}
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
