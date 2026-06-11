import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ActiveVoucherLog({ vouchers, setVouchers, addSystemLog }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Unused', 'Expired'
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set()); // Reset selection on filter change
  }, [searchTerm, statusFilter]);

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

  const totalPages = Math.ceil(filteredVouchers.length / itemsPerPage);
  const paginatedVouchers = filteredVouchers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  const visiblePages = [];
  for (let i = startPage; i <= endPage; i++) {
    visiblePages.push(i);
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set(selectedIds);
      filteredVouchers.forEach(v => newSelected.add(v.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      filteredVouchers.forEach(v => newSelected.delete(v.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.size} voucher terpilih?`)) {
      setVouchers(vouchers.filter(v => !selectedIds.has(v.id)));
      addSystemLog('SYSTEM', `Menghapus ${selectedIds.size} voucher secara massal`);
      setSelectedIds(new Set());
    }
  };

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

  if (selectedVoucher) {
    return (
      <div className="w-full space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-surface-variant pb-4">
          <button 
            onClick={() => setSelectedVoucher(null)}
            className="p-2 bg-surface-container-low hover:bg-surface-container-high rounded-full text-on-surface-variant transition-colors flex items-center justify-center"
            aria-label="Kembali"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-3">
              Detail Voucher
              <span className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                selectedVoucher.status === 'Active' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' :
                selectedVoucher.status === 'Unused' ? 'bg-surface-container-high text-on-surface-variant' :
                'bg-error-container text-on-error-container'
              }`}>
                {selectedVoucher.status === 'Active' ? 'Aktif' : selectedVoucher.status === 'Unused' ? 'Belum Dipakai' : 'Expired'}
              </span>
            </h2>
            <p className="font-mono text-[18px] font-bold text-primary mt-1">{selectedVoucher.code}</p>
          </div>
          
          <div className="ml-auto flex gap-3">
            {selectedVoucher.status === 'Active' && (
              <button
                onClick={() => {
                  handleDisconnect(selectedVoucher.id, selectedVoucher.code);
                  setSelectedVoucher(null);
                }}
                className="px-4 py-2 bg-error-container hover:bg-error/20 text-error font-label-md rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">wifi_off</span>
                Putus Sesi
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Sidebar Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-label-sm text-on-surface-variant uppercase font-bold tracking-wider border-b border-surface-variant pb-2">Informasi Paket</h3>
              
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">Paket</p>
                <p className="font-body-md text-[14px] text-on-surface">{selectedVoucher.package}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">Harga</p>
                <p className="font-body-md text-[14px] text-on-surface font-semibold text-primary">Rp {selectedVoucher.price.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">Waktu Aktivasi</p>
                <p className="font-body-md text-[14px] text-on-surface">{selectedVoucher.activatedTime || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">Sisa Waktu</p>
                <p className="font-mono text-[14px] text-on-surface font-bold text-primary">
                  {selectedVoucher.expiresAt !== undefined ? (() => {
                    const remaining = selectedVoucher.expiresAt - Date.now();
                    return remaining <= 0 ? 'Waktu Habis' : formatCountdown(remaining);
                  })() : selectedVoucher.timeLeft}
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-label-sm text-on-surface-variant uppercase font-bold tracking-wider border-b border-surface-variant pb-2">Informasi Jaringan</h3>
              
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">MAC Address</p>
                <p className="font-mono text-[14px] text-on-surface">{selectedVoucher.macAddress || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">IP Address</p>
                <p className="font-mono text-[14px] text-on-surface">{selectedVoucher.ipAddress || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-semibold">ID Sesi (Session-ID)</p>
                <p className="font-mono text-[14px] text-on-surface text-on-surface-variant">
                  {selectedVoucher.status === 'Active' ? `RAD-${selectedVoucher.id}0A8X` : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">data_usage</span>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant font-semibold uppercase">Total Pemakaian</p>
                  <p className="font-mono text-[20px] font-bold text-on-surface">{selectedVoucher.usedBytes || '0 MB'}</p>
                </div>
              </div>
              
              <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[24px]">timer</span>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant font-semibold uppercase">Lama Sesi (Uptime)</p>
                  <p className="font-mono text-[20px] font-bold text-on-surface">{selectedVoucher.status === 'Active' ? '01:45:22' : '-'}</p>
                </div>
              </div>
            </div>

            {/* Riwayat Sesi */}
            <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-surface-variant bg-surface-container-low">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Riwayat Sesi Lengkap</h3>
              </div>
              
              {selectedVoucher.status === 'Unused' ? (
                <div className="text-center p-12 text-on-surface-variant text-[14px] italic">
                  Belum ada riwayat sesi. Voucher belum pernah digunakan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-surface-container-lowest text-on-surface-variant border-b border-surface-variant">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Waktu Mulai</th>
                        <th className="px-5 py-3 font-semibold">Waktu Selesai</th>
                        <th className="px-5 py-3 font-semibold">Durasi</th>
                        <th className="px-5 py-3 font-semibold">Pemakaian Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container font-mono text-on-surface">
                      {selectedVoucher.status === 'Active' && (
                        <tr className="bg-tertiary/5 hover:bg-tertiary/10 transition-colors border-l-4 border-l-tertiary">
                          <td className="px-5 py-3 text-tertiary">Hari ini</td>
                          <td className="px-5 py-3 text-tertiary font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                            Aktif
                          </td>
                          <td className="px-5 py-3 font-bold text-tertiary">01:45:22</td>
                          <td className="px-5 py-3 text-tertiary font-bold">45 MB</td>
                        </tr>
                      )}
                      <tr className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-5 py-3 text-on-surface-variant">10/06 08:15</td>
                        <td className="px-5 py-3 text-on-surface-variant">10/06 10:00</td>
                        <td className="px-5 py-3">01:45:00</td>
                        <td className="px-5 py-3 text-primary font-medium">120 MB</td>
                      </tr>
                      <tr className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-5 py-3 text-on-surface-variant">11/06 14:20</td>
                        <td className="px-5 py-3 text-on-surface-variant">11/06 15:50</td>
                        <td className="px-5 py-3">01:30:00</td>
                        <td className="px-5 py-3 text-primary font-medium">85 MB</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fadeIn">
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

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-error-container/20 border border-error/30 rounded-xl p-3 shadow-sm flex items-center justify-between mb-4 animate-fadeIn">
          <span className="text-on-surface font-medium text-[14px]">
            {selectedIds.size} voucher terpilih
          </span>
          <button
            onClick={handleBulkDelete}
            className="bg-error text-on-error hover:bg-error/90 font-label-md text-label-md px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Hapus Terpilih
          </button>
        </div>
      )}

      {/* Vouchers Table */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4 w-10">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={filteredVouchers.length > 0 && filteredVouchers.every(v => selectedIds.has(v.id))}
                    className="rounded border-outline cursor-pointer w-4 h-4 text-primary focus:ring-primary/20"
                  />
                </th>
                <th className="p-4">Kode Voucher</th>
                <th className="p-4">Paket & Tarif</th>
                <th className="p-4">Status</th>
                <th className="p-4">IP / MAC Address</th>
                <th className="p-4">Waktu Aktivasi</th>
                <th className="p-4">Pemakaian</th>
                <th className="p-4">Sisa Waktu</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-on-surface-variant italic">
                    Tidak ada voucher yang ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((v) => (
                  <tr key={v.id} className={`hover:bg-surface-container-lowest/50 transition-colors ${selectedIds.has(v.id) ? 'bg-primary/5 hover:bg-primary/10' : ''}`}>
                    {/* Checkbox */}
                    <td className="p-4 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(v.id)}
                        onChange={() => handleSelectRow(v.id)}
                        className="rounded border-outline cursor-pointer w-4 h-4 text-primary focus:ring-primary/20"
                      />
                    </td>
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
                    
                    {/* IP & MAC */}
                    <td className="p-4">
                      <div className="font-mono text-[12px] text-primary font-medium mb-0.5" title="IP Address">
                        {v.ipAddress || '-'}
                      </div>
                      <div className="font-mono text-[10px] text-on-surface-variant flex items-center gap-1" title="MAC Address">
                        {v.macAddress || '-'}
                      </div>
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-surface-variant bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-label-sm text-on-surface-variant">
              Menampilkan <span className="font-bold text-on-surface">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="font-bold text-on-surface">{Math.min(currentPage * itemsPerPage, filteredVouchers.length)}</span> dari <span className="font-bold text-on-surface">{filteredVouchers.length}</span> voucher
            </p>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-surface-container disabled:opacity-50 transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              
              <div className="flex items-center gap-1">
                {startPage > 1 && (
                  <>
                    <button onClick={() => setCurrentPage(1)} className="min-w-[28px] h-7 rounded text-[12px] font-bold transition-colors px-1 hover:bg-surface-container text-on-surface-variant">1</button>
                    {startPage > 2 && <span className="text-on-surface-variant text-[12px] px-1">...</span>}
                  </>
                )}
                {visiblePages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[28px] h-7 rounded text-[12px] font-bold transition-colors px-1 ${
                      currentPage === page 
                        ? 'bg-primary text-on-primary shadow-[0_2px_4px_rgba(77,68,227,0.3)]' 
                        : 'hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {endPage < totalPages && (
                  <>
                    {endPage < totalPages - 1 && <span className="text-on-surface-variant text-[12px] px-1">...</span>}
                    <button onClick={() => setCurrentPage(totalPages)} className="min-w-[28px] h-7 rounded text-[12px] font-bold transition-colors px-1 hover:bg-surface-container text-on-surface-variant">{totalPages}</button>
                  </>
                )}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-surface-container disabled:opacity-50 transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
