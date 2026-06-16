import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { createPortal } from 'react-dom';

export default function ActiveVoucherLog({ vouchers, setVouchers, fetchVouchers, addSystemLog, voucherTemplate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Unused', 'Expired'
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

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

  useEffect(() => {
    if (selectedVoucher) {
      setLoadingSessions(true);
      apiFetch(`/api/vouchers/sessions/${selectedVoucher.code}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            setSessions(json.data);
          } else {
            setSessions([]);
          }
          setLoadingSessions(false);
        })
        .catch(err => {
          console.error('Error fetching sessions:', err);
          setSessions([]);
          setLoadingSessions(false);
        });
    } else {
      setSessions([]);
    }
  }, [selectedVoucher]);

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
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
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
      const voucherIds = [];
      const logIds = [];
      selectedIds.forEach(id => {
        if (String(id).startsWith('log-')) {
          logIds.push(parseInt(String(id).replace('log-', ''), 10));
        } else {
          voucherIds.push(id);
        }
      });

      const promises = [];
      if (voucherIds.length > 0) {
        promises.push(
          apiFetch('/api/vouchers/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: voucherIds })
          }).then(res => res.json())
        );
      }
      if (logIds.length > 0) {
        promises.push(
          apiFetch('/api/voucher-logs/bulk/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: logIds })
          }).then(res => res.json())
        );
      }

      Promise.all(promises)
        .then(results => {
          const allSuccess = results.every(r => r.success);
          if (allSuccess) {
            fetchVouchers();
            addSystemLog('SYSTEM', `Menghapus ${selectedIds.size} voucher secara massal`);
            setSelectedIds(new Set());
          } else {
            alert('Beberapa penghapusan massal gagal.');
          }
        })
        .catch(err => alert('Error: ' + err.message));
    }
  };

  const handlePrintSelected = () => {
    if (selectedIds.size === 0) return;
    const printArea = document.getElementById('printable-voucher-items-log');
    if (!printArea) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Silakan izinkan Popup pada browser Anda untuk mencetak tiket di halaman baru.");
      return;
    }

    let styles = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      styles += node.outerHTML;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <title>Cetak Tiket Voucher</title>
          ${styles}
          <style>
            body { background: white; padding: 20px; }
            @media print {
              @page { margin: 5mm; }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2 class="text-center font-black text-[24px] mb-6 tracking-wider uppercase border-b-2 border-black pb-2 mx-auto max-w-sm font-sans">
            Voucher Internet
          </h2>
          <div class="flex flex-wrap gap-4 justify-center items-start content-start">
            ${printArea.innerHTML}
          </div>
          <script>
            setTimeout(() => {
              window.print();
            }, 800);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDisconnect = (id, code) => {
    if (window.confirm(`Apakah Anda yakin ingin mematikan sesi untuk voucher ${code}?`)) {
      apiFetch(`/api/vouchers/${id}/disconnect`, { method: 'POST' })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            fetchVouchers();
            addSystemLog('ACCT', `Stop: Sesi voucher ${code} diputus secara paksa oleh Admin`, '88A9B2', '192.168.1.45');
          } else {
            alert(json.message || 'Gagal memutus sesi voucher.');
          }
        })
        .catch(err => alert('Error: ' + err.message));
    }
  };

  const handleEditMac = (id, currentMac) => {
    const newMac = window.prompt("Ubah MAC Address Voucher (kosongkan untuk hapus kuncian):", currentMac || "");
    if (newMac !== null) {
      apiFetch(`/api/vouchers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac_address: newMac || null })
      })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            fetchVouchers();
            addSystemLog('SYSTEM', `MAC Address voucher ID ${id} diubah menjadi "${newMac}"`);
          } else {
            alert(json.message || 'Gagal mengubah MAC Address.');
          }
        })
        .catch(err => alert('Error: ' + err.message));
    }
  };

  const handleDelete = (id, code) => {
    if (window.confirm(`Hapus voucher ${code} secara permanen dari sistem?`)) {
      const url = String(id).startsWith('log-')
        ? `/api/voucher-logs/${String(id).replace('log-', '')}`
        : `/api/vouchers/${id}`;
      apiFetch(url, { method: 'DELETE' })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            fetchVouchers();
            addSystemLog('SYSTEM', `Voucher ${code} dihapus oleh Admin`);
          } else {
            alert(json.message || 'Gagal menghapus voucher.');
          }
        })
        .catch(err => alert('Error: ' + err.message));
    }
  };



  if (selectedVoucher) {
    const currentUptime = sessions.reduce((acc, s) => {
      if (!s.ended_at) {
        const elapsed = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000);
        return acc + Math.max(0, elapsed);
      }
      return acc + (s.duration_secs || 0);
    }, 0);

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
                {selectedVoucher.status === 'Active' ? 'Aktif' : selectedVoucher.status === 'Unused' ? 'Waiting' : 'Expired'}
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
                  <p className="font-mono text-[20px] font-bold text-on-surface">
                    {sessions.length > 0 ? formatCountdown(currentUptime * 1000) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Riwayat Sesi */}
            <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-surface-variant bg-surface-container-low">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Riwayat Sesi Lengkap</h3>
              </div>
              
              {loadingSessions ? (
                <div className="text-center p-8 text-[14px] text-on-surface-variant">
                  Memuat riwayat sesi...
                </div>
              ) : sessions.length === 0 ? (
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
                      {sessions.map(sess => {
                        const isActive = !sess.ended_at;
                        const elapsed = isActive 
                          ? Math.floor((Date.now() - new Date(sess.started_at).getTime()) / 1000) 
                          : sess.duration_secs;
                        return (
                          <tr key={sess.radacctid} className={isActive ? "bg-tertiary/5 hover:bg-tertiary/10 transition-colors border-l-4 border-l-tertiary" : "hover:bg-surface-container-low/50 transition-colors"}>
                            <td className={isActive ? "px-5 py-3 text-tertiary" : "px-5 py-3 text-on-surface-variant"}>
                              {new Date(sess.started_at).toLocaleString('id-ID')}
                            </td>
                            <td className={isActive ? "px-5 py-3 text-tertiary font-bold flex items-center gap-1.5" : "px-5 py-3 text-on-surface-variant"}>
                              {isActive ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                                  Aktif
                                </>
                              ) : (
                                new Date(sess.ended_at).toLocaleString('id-ID')
                              )}
                            </td>
                            <td className={isActive ? "px-5 py-3 font-bold text-tertiary" : "px-5 py-3"}>
                              {formatCountdown(elapsed * 1000)}
                            </td>
                            <td className={isActive ? "px-5 py-3 text-tertiary font-bold" : "px-5 py-3 text-primary font-medium"}>
                              {formatBytes(sess.used_bytes)}
                            </td>
                          </tr>
                        );
                      })}
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
          <div className="flex gap-2">
            <button
              onClick={handlePrintSelected}
              className="bg-tertiary text-on-tertiary hover:bg-tertiary/90 font-label-md text-label-md px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Cetak Terpilih
            </button>
            <button
              onClick={handleBulkDelete}
              className="bg-error text-on-error hover:bg-error/90 font-label-md text-label-md px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Hapus Terpilih
            </button>
          </div>
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
                        {v.status === 'Active' ? 'Aktif' : v.status === 'Unused' ? 'Waiting' : 'Expired'}
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
                    
                    {/* Time Left & Valid Until */}
                    <td className="p-4">
                      <div className="font-mono font-semibold">
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
                      </div>
                      {v.validUntil && v.validUntil !== '-' && (
                        <div className="text-[10px] text-on-surface-variant mt-1">
                          Aktif s/d: <br/>{v.validUntil}
                        </div>
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
                        {v.status !== 'Expired' && (
                          <button
                            onClick={() => handleEditMac(v.id, v.macAddress)}
                            title="Edit MAC Address"
                            className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm p-1.5 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        )}
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

      {/* Printable Area - Render ONLY when printing selected vouchers */}
      <div className="hidden print:block w-full text-black font-sans" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <h2 className="text-center font-black text-[24px] mb-6 tracking-wider uppercase border-b-2 border-black pb-2 mx-auto max-w-sm">
          Voucher Internet
        </h2>
        <div id="printable-voucher-items-log" className="flex flex-wrap gap-4 justify-center">
          {vouchers.filter(v => selectedIds.has(v.id)).map((item, idx) => {
            // Determine colors dynamically based on package or price
            const palettes = [
              { main: '#14478C', sub: '#1E62C2', light: '#E6F0FA' }, // Blue
              { main: '#C62828', sub: '#E53935', light: '#FFEBEE' }, // Red
              { main: '#2E7D32', sub: '#43A047', light: '#E8F5E9' }, // Green
              { main: '#F57F17', sub: '#FBC02D', light: '#FFFDE7' }, // Yellow/Orange
              { main: '#4527A0', sub: '#5E35B1', light: '#EDE7F6' }, // Purple
              { main: '#00695C', sub: '#00897B', light: '#E0F2F1' }, // Teal
              { main: '#AD1457', sub: '#D81B60', light: '#FCE4EC' }, // Pink
            ];
            // Hash the package name or use price to pick a consistent color
            let hash = 0;
            for (let i = 0; i < item.package.length; i++) {
              hash = item.package.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colorIndex = Math.abs(hash) % palettes.length;
            const palette = palettes[colorIndex];

            let html = voucherTemplate || '';
            html = html.replace(/\{\{kode\}\}/g, item.code);
            html = html.replace(/\{\{password\}\}/g, item.password || item.code);
            html = html.replace(/\{\{paket\}\}/g, item.package);
            html = html.replace(/\{\{harga\}\}/g, 'Rp ' + item.price.toLocaleString('id-ID'));
            const masaAktif = (item.status === 'Active' && item.validUntil && item.validUntil !== '-') ? item.validUntil : (item.validity || item.timeLeft || '-');
            html = html.replace(/\{\{masa_aktif\}\}/g, masaAktif);
            html = html.replace(/\{\{durasi\}\}/g, item.duration || '-');
            
            // Apply dynamic colors
            html = html.replace(/\{\{warna_utama\}\}/g, palette.main);
            html = html.replace(/\{\{warna_sekunder\}\}/g, palette.sub);
            html = html.replace(/\{\{warna_muda\}\}/g, palette.light);
            
            return (
              <div 
                key={idx} 
                dangerouslySetInnerHTML={{ __html: html }} 
                style={{ pageBreakInside: 'avoid' }}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}
