import React, { useState, useEffect } from 'react';

export default function ActiveVoucherLog({ vouchers, setVouchers, addSystemLog }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Unused', 'Expired'
  const [selectedVoucher, setSelectedVoucher] = useState(null);

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

  const handleEditMac = (id, currentMac) => {
    const newMac = window.prompt("Ubah MAC Address Voucher (kosongkan untuk hapus kuncian):", currentMac || "");
    if (newMac !== null) {
      setVouchers(vouchers.map(v => v.id === id ? { ...v, macAddress: newMac } : v));
      addSystemLog('SYSTEM', `MAC Address voucher ID ${id} diubah menjadi "${newMac}"`);
    }
  };

  const handleDelete = (id, code) => {
    if (window.confirm(`Hapus voucher ${code} secara permanen dari sistem?`)) {
      setVouchers(vouchers.filter(v => v.id !== id));
      addSystemLog('SYSTEM', `Voucher ${code} dihapus oleh Admin`);
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
              const headers = ['Kode', 'Password', 'Paket', 'Harga', 'Status', 'MAC Address', 'IP', 'Waktu Aktivasi', 'Pemakaian'];
              const rows = filteredVouchers.map(v => [
                v.code,
                v.password || '',
                v.package,
                v.price,
                v.status,
                v.macAddress || '',
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
                <th className="p-4">MAC Address</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Waktu Aktivasi</th>
                <th className="p-4">Pemakaian</th>
                <th className="p-4">Sisa Waktu</th>
                <th className="p-4 text-center">Aksi</th>
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
                    <td className="p-4">
                      <button 
                        onClick={() => setSelectedVoucher(v)}
                        className="font-mono font-bold text-primary hover:text-primary-container hover:underline text-[14px] transition-colors"
                      >
                        {v.code}
                      </button>
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
                    
                    {/* MAC */}
                    <td className="p-4 font-mono text-[11px] text-on-surface-variant">
                      {v.macAddress || '-'}
                    </td>
                    
                    {/* IP */}
                    <td className="p-4 font-mono text-[11px] text-on-surface-variant">
                      {v.ipAddress || '-'}
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
                    
                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center gap-1">
                        {v.status === 'Active' && (
                          <button
                            onClick={() => handleDisconnect(v.id, v.code)}
                            title="Putus Sesi (Kick)"
                            className="bg-error-container hover:bg-error/20 text-error font-label-sm p-1.5 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">wifi_off</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEditMac(v.id, v.macAddress)}
                          title="Edit MAC Address"
                          className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm p-1.5 rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.code)}
                          title="Hapus Voucher"
                          className="bg-surface-container hover:bg-error-container/50 text-error font-label-sm p-1.5 rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-surface-variant animate-slideIn">
            <div className="px-6 py-4 border-b border-surface-container bg-surface-container-low flex justify-between items-center">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Detail Voucher</h3>
              <button 
                onClick={() => setSelectedVoucher(null)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Header Info */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase font-semibold mb-1">Kode Voucher</p>
                  <p className="font-mono text-[24px] font-bold text-on-surface">{selectedVoucher.code}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                  selectedVoucher.status === 'Active' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' :
                  selectedVoucher.status === 'Unused' ? 'bg-surface-container-high text-on-surface-variant' :
                  'bg-error-container text-on-error-container'
                }`}>
                  {selectedVoucher.status === 'Active' ? 'Aktif' : selectedVoucher.status === 'Unused' ? 'Belum Dipakai' : 'Expired'}
                </span>
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 bg-surface-container-low p-4 rounded-lg border border-surface-container">
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Paket</p>
                  <p className="font-body-md text-[14px] text-on-surface">{selectedVoucher.package}</p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Harga</p>
                  <p className="font-body-md text-[14px] text-on-surface font-semibold">Rp {selectedVoucher.price.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Waktu Aktivasi</p>
                  <p className="font-body-md text-[14px] text-on-surface">{selectedVoucher.activatedTime || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Sisa Waktu</p>
                  <p className="font-mono text-[14px] text-on-surface font-bold text-primary">
                    {selectedVoucher.expiresAt !== undefined ? (() => {
                      const remaining = selectedVoucher.expiresAt - Date.now();
                      return remaining <= 0 ? 'Waktu Habis' : formatCountdown(remaining);
                    })() : selectedVoucher.timeLeft}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">MAC Address</p>
                  <p className="font-mono text-[14px] text-on-surface">{selectedVoucher.macAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">IP Address</p>
                  <p className="font-mono text-[14px] text-on-surface">{selectedVoucher.ipAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Pemakaian Data</p>
                  <p className="font-mono text-[14px] text-on-surface">{selectedVoucher.usedBytes || '0 MB'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">ID Sesi (Session-ID)</p>
                  <p className="font-mono text-[14px] text-on-surface text-on-surface-variant">
                    {selectedVoucher.status === 'Active' ? `RAD-${selectedVoucher.id}0A8X` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Lama Sesi (Uptime)</p>
                  <p className="font-mono text-[14px] text-on-surface text-on-surface-variant">
                    {selectedVoucher.status === 'Active' ? '01:45:22' : '-'}
                  </p>
                </div>
              </div>
              
              {/* Riwayat Sesi */}
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase font-semibold mb-2">Riwayat Sesi Terakhir</p>
                {selectedVoucher.status === 'Unused' ? (
                  <div className="text-center p-4 border border-surface-variant border-dashed rounded-lg text-on-surface-variant text-[12px] italic bg-surface-container-lowest">
                    Belum ada riwayat sesi. Voucher belum pernah digunakan.
                  </div>
                ) : (
                  <div className="border border-surface-variant rounded-lg overflow-hidden overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-[12px] min-w-[350px]">
                      <thead className="bg-surface-container-low text-on-surface-variant border-b border-surface-variant">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Mulai</th>
                          <th className="px-3 py-2 font-semibold">Selesai</th>
                          <th className="px-3 py-2 font-semibold">Durasi</th>
                          <th className="px-3 py-2 font-semibold">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container bg-surface-container-lowest font-mono text-on-surface">
                        <tr className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-3 py-2 text-on-surface-variant">10/06 08:15</td>
                          <td className="px-3 py-2 text-on-surface-variant">10/06 10:00</td>
                          <td className="px-3 py-2">01:45:00</td>
                          <td className="px-3 py-2 text-primary">120 MB</td>
                        </tr>
                        <tr className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-3 py-2 text-on-surface-variant">11/06 14:20</td>
                          <td className="px-3 py-2 text-on-surface-variant">11/06 15:50</td>
                          <td className="px-3 py-2">01:30:00</td>
                          <td className="px-3 py-2 text-primary">85 MB</td>
                        </tr>
                        {selectedVoucher.status === 'Active' && (
                          <tr className="bg-tertiary/5 hover:bg-tertiary/10 transition-colors">
                            <td className="px-3 py-2 text-tertiary">Hari ini</td>
                            <td className="px-3 py-2 text-tertiary font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                              Aktif
                            </td>
                            <td className="px-3 py-2 font-bold text-tertiary">01:45:22</td>
                            <td className="px-3 py-2 text-tertiary font-bold">45 MB</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-container flex justify-end gap-3 bg-surface-container-lowest">
              {selectedVoucher.status === 'Active' && (
                <button
                  onClick={() => {
                    handleDisconnect(selectedVoucher.id, selectedVoucher.code);
                    setSelectedVoucher(null);
                  }}
                  className="px-4 py-2 bg-error-container hover:bg-error/20 text-error font-label-md rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">wifi_off</span>
                  Putus Sesi
                </button>
              )}
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary font-label-md rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
