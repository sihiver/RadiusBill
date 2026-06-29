import React, { useState } from 'react';
import { apiFetch } from '../App';
import { createPortal } from 'react-dom';

const formatLocalDateForInput = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function RouterList({ routers, setRouters, fetchRouters, packages, addSystemLog, requestConfirm, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [pppoeUser, setPppoeUser] = useState('');
  const [pppoePass, setPppoePass] = useState('');
  const [routerIp, setRouterIp] = useState('');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [status, setStatus] = useState('Online'); // Online, Offline, Isolated
  const [expiryDate, setExpiryDate] = useState('');

  // Search filter
  const [search, setSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;


  const handleToggleIsolir = (router) => {
    const isNowIsolated = router.status !== 'Isolated';
    const action = isNowIsolated ? 'isolir' : 'unisolir';
    
    requestConfirm({
      title: isNowIsolated ? 'Isolasi Router PPPoE' : 'Buka Isolasi Router PPPoE',
      message: isNowIsolated 
        ? `Apakah Anda yakin ingin memblokir akses internet untuk pelanggan "${router.customerName}" (@${router.pppoeUser})?`
        : `Apakah Anda yakin ingin memulihkan akses internet untuk pelanggan "${router.customerName}" (@${router.pppoeUser})?`,
      confirmText: isNowIsolated ? 'Ya, Isolir' : 'Ya, Buka Isolir',
      cancelText: 'Batal',
      variant: isNowIsolated ? 'danger' : 'success',
      onConfirm: () => {
        apiFetch(`/api/routers/${router.id}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Tunggakan tagihan' })
        })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            if(addNotification) addNotification(json.message, 'success');
            if (isNowIsolated) {
              addSystemLog('REJECT', `Isolir Aktif: Akun PPPoE @${router.pppoeUser} diblokir (Tunggakan Tagihan)`, 'REJECT-BILL', router.routerIp);
            } else {
              addSystemLog('AUTH', `Isolir Dimatikan: Akun PPPoE @${router.pppoeUser} kembali diaktifkan`, router.routerIp, 'PPPoE');
            }
            fetchRouters();
          } else {
            if(addNotification) addNotification(`Gagal mengubah status isolir: ${json.message}`, 'error');
          }
        })
        .catch(err => {
          if(addNotification) addNotification(`Gagal mengubah status isolir: ${err.message}`, 'error');
        });
      }
    });
  };

  const handleExtend = (id, customerName) => {
    requestConfirm({
      title: 'Perpanjang Masa Aktif',
      message: `Apakah Anda yakin ingin memperpanjang paket PPPoE untuk "${customerName}" selama 30 hari? Status isolir akan otomatis dibuka.`,
      confirmText: 'Ya, Perpanjang',
      variant: 'primary',
      onConfirm: () => {
        apiFetch(`/api/routers/${id}/extend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: 30 })
        })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchRouters();
              addSystemLog('SYSTEM', `Memperpanjang paket PPPoE: "${customerName}"`);
            } else {
              alert(json.message || 'Gagal memperpanjang paket.');
            }
          })
          .catch(err => alert('Error: ' + err.message));
      }
    });
  };

  const pppoePackages = packages.filter(p => p.type === 'PPPoE');

  const openAddModal = () => {
    setEditingId(null);
    setErrorMsg('');
    setCustomerName('');
    setPppoeUser('');
    setPppoePass('');
    
    // Generate next IP e.g. 10.10.10.X
    const lastIp = routers.length > 0 ? routers[routers.length - 1].routerIp : '10.10.10.1';
    const lastOctet = Number(lastIp.split('.').pop()) || 1;
    setRouterIp(`10.10.10.${lastOctet + 1}`);
    
    setSelectedPkg(pppoePackages[0]?.name || '');
    setStatus('Online');
    setExpiryDate('');
    setShowModal(true);
  };

  const openEditModal = (router) => {
    setEditingId(router.id);
    setErrorMsg('');
    setCustomerName(router.customerName);
    setPppoeUser(router.pppoeUser);
    setPppoePass(router.pppoePass);
    setRouterIp(router.routerIp === '-' ? '' : router.routerIp);
    setSelectedPkg(router.package);
    setStatus(router.status);
    setExpiryDate(router.expiry_date ? formatLocalDateForInput(router.expiry_date) : '');
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!customerName.trim() || !pppoeUser.trim()) return;

    // Validate duplicate PPPoE Username
    const isDuplicate = routers.some(r => r.pppoeUser.toLowerCase() === pppoeUser.trim().toLowerCase() && r.id !== editingId);
    if (isDuplicate) {
      setErrorMsg('Username PPPoE sudah digunakan oleh router lain.');
      return;
    }

    const pkg = packages.find(p => p.name === selectedPkg);

    const payload = {
      customer_name: customerName.trim(),
      pppoe_user: pppoeUser.trim(),
      pppoe_pass: pppoePass.trim(),
      router_ip: (routerIp.trim() === '-' || !routerIp.trim()) ? null : routerIp.trim(),
      package_id: pkg ? pkg.id : null,
      package_name: pkg ? pkg.name : null,
      status: status,
      isolir: status === 'Isolated',
      expiry_date: expiryDate || null
    };

    const url = editingId ? `/api/routers/${editingId}` : '/api/routers';
    const method = editingId ? 'PUT' : 'POST';

    apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          fetchRouters();
          addSystemLog('SYSTEM', editingId ? `Mengubah profil router PPPoE pelanggan: "${customerName}"` : `Mendaftarkan Router PPPoE baru untuk "${customerName}"`);
          setShowModal(false);
        } else {
          setErrorMsg(json.message || (json.details ? json.details.join(', ') : json.error) || 'Gagal menyimpan router.');
        }
      })
      .catch(err => {
        setErrorMsg('Error: ' + err.message);
      });
  };

  const handleDelete = (id, name) => {
    requestConfirm({
      title: 'Hapus Router PPPoE',
      message: `Hapus instalasi router PPPoE untuk "${name}"? Koneksi akan terputus permanen.`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: () => {
        apiFetch(`/api/routers/${id}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchRouters();
              addSystemLog('SYSTEM', `Menghapus router PPPoE pelanggan: "${name}"`);
            } else {
              alert(json.message || 'Gagal menghapus router.');
            }
          })
          .catch(err => alert('Error: ' + err.message));
      }
    });
  };

  
  const handleBulkDelete = () => {
    requestConfirm({
      title: 'Hapus Banyak Router',
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} router terpilih? Semua data terkait akan dihapus permanen.`,
      confirmText: 'Ya, Hapus Semua',
      variant: 'danger',
      onConfirm: () => {
        apiFetch('/api/routers/bulk', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchRouters();
              addSystemLog('SYSTEM', `Menghapus ${selectedIds.length} Router PPPoE secara massal`);
              setSelectedIds([]);
            } else {
              alert(json.message || 'Gagal menghapus router.');
            }
          })
          .catch(err => alert('Error: ' + err.message));
      }
    });
  };

  const filteredRouters = routers.filter(r => 
    r.customerName.toLowerCase().includes(search.toLowerCase()) || 
    r.pppoeUser.toLowerCase().includes(search.toLowerCase()) || 
    r.routerIp.includes(search)
  );

  
  const totalPages = Math.ceil(filteredRouters.length / rowsPerPage);
  const paginatedRouters = filteredRouters.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Daftar Router PPPoE Rumah</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Registrasi pelanggan router rumah bulanan, detail IP, dan sinkronisasi status ke Mikrotik.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">router</span>
          Tambah Router Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 shadow-[0_1px_3px_rgba(77,68,227,0.03)] flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Cari nama pelanggan atau PPPoE user..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-surface-dim rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-error hover:bg-error/90 text-white font-label-md px-4 py-2 rounded-full transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Hapus ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="text-label-sm text-on-surface-variant whitespace-nowrap">
          Total Router Rumah: <span className="font-bold text-on-surface">{routers.length} Instalasi</span>
        </div>
      </div>

      {/* Routers Table */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20 cursor-pointer"
                    checked={filteredRouters.length > 0 && selectedIds.length === filteredRouters.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredRouters.map(m => m.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th className="p-4">Pelanggan Rumah</th>
                <th className="p-4">PPPoE Credentials</th>
                <th className="p-4">Router IP Address</th>
                <th className="p-4">Paket Langganan</th>
                <th className="p-4">Masa Aktif</th>
                <th className="p-4">Status Koneksi</th>
                <th className="p-4 text-center">Isolir</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {paginatedRouters.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-on-surface-variant italic">
                    Tidak ada router PPPoE ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedRouters.map((r) => {
                  return (
                  <tr key={r.id} className={`hover:bg-surface-container-lowest/50 transition-colors ${r.status === 'Isolated' ? 'bg-red-50/30' : ''}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20 cursor-pointer"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, r.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== r.id));
                          }
                        }}
                      />
                    </td>
                    {/* Customer Name */}
                    <td className="p-4 font-bold text-on-surface text-[14px]">
                      {r.customerName}
                    </td>

                    {/* PPPoE Credentials */}
                    <td className="p-4 font-mono">
                      <div className="text-primary font-bold">User: <span className="select-all">@{r.pppoeUser}</span></div>
                      <div className="text-[11px] text-on-surface-variant">Pass: <span className="select-all">{r.pppoePass}</span></div>
                    </td>

                    {/* IP */}
                    <td className="p-4 font-mono font-semibold text-on-surface-variant">
                      {r.routerIp}
                    </td>

                    {/* Package */}
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded text-[10px] font-bold">
                        {r.package_name || r.package || '-'}
                      </span>
                    </td>

                    {/* Active Period */}
                    <td className="p-4">
                      {(() => {
                        if (!r.expiry_date) return <span className="text-on-surface-variant text-[11px]">-</span>;
                        const now = new Date();
                        const exp = new Date(r.expiry_date);
                        const isExpired = exp < now;
                        const diffDays = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
                        return (
                          <div>
                            <div className={`text-[12px] font-bold ${isExpired ? 'text-error' : 'text-green-600'}`}>
                              {isExpired ? 'Kedaluwarsa' : 'Aktif'}
                            </div>
                            <div className="text-[10px] text-on-surface-variant mt-0.5">
                              s/d {exp.toLocaleDateString('id-ID')} {isExpired ? '' : `(${diffDays} hr)`}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Connection Status */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          r.status === 'Online' ? 'bg-tertiary-container animate-pulse' :
                          r.status === 'Offline' ? 'bg-outline' : 'bg-error animate-ping'
                        }`}></span>
                        <span className={`font-bold ${
                          r.status === 'Online' ? 'text-tertiary' :
                          r.status === 'Offline' ? 'text-on-surface-variant' : 'text-error'
                        }`}>
                          {r.status === 'Online' ? 'Online' :
                           r.status === 'Offline' ? 'Offline' : 'Terisolir'}
                        </span>
                      </div>
                    </td>

                    {/* Isolir Toggle Switch */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center">
                        <label className="relative inline-flex items-center cursor-pointer" title={r.status === 'Isolated' ? 'Buka Isolir' : 'Isolir'}>
                          <input 
                            type="checkbox" 
                            checked={r.status === 'Isolated'}
                            onChange={() => handleToggleIsolir(r)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-surface-container rounded-full peer peer-focus:ring-2 peer-focus:ring-error/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-error"></div>
                        </label>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => handleExtend(r.id, r.customerName || r.customer_name)}
                          className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors"
                          title="Perpanjang Paket"
                        >
                          <span className="material-symbols-outlined text-[18px]">update</span>
                        </button>
                        <button
                          onClick={() => openEditModal(r)}
                          className="text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
                          title="Edit Router"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.customerName)}
                          className="text-error hover:bg-error-container/20 p-1.5 rounded transition-colors"
                          title="Hapus Router"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-surface-variant flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-4">
            <span className="text-label-sm text-on-surface-variant">
              Menampilkan {Math.min(filteredRouters.length, (currentPage - 1) * rowsPerPage + 1 || 0)} - {Math.min(filteredRouters.length, currentPage * rowsPerPage)} dari {filteredRouters.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span className="font-label-md text-on-surface w-10 text-center">{currentPage} / {totalPages || 1}</span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full shadow-2xl border border-surface-variant overflow-hidden animate-slideIn flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low shrink-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {editingId ? 'Edit Router PPPoE' : 'Registrasi Router Rumah'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 space-y-4 overflow-y-auto">
              {errorMsg && (
                <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Nama Pelanggan / Rumah *</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => { setCustomerName(e.target.value); setErrorMsg(''); }}
                  placeholder="e.g. Rumah Keluarga Budi" 
                  required
                  className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">PPPoE Username *</label>
                  <input 
                    type="text" 
                    value={pppoeUser} 
                    onChange={(e) => { setPppoeUser(e.target.value); setErrorMsg(''); }}
                    placeholder="e.g. budi_router" 
                    required
                    className={`w-full px-3.5 py-2 border rounded-lg text-body-md focus:outline-none focus:ring-2 transition-all ${
                      errorMsg ? 'border-error focus:ring-error/20 focus:border-error' : 'border-surface-dim focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">PPPoE Password *</label>
                  <input 
                    type="text" 
                    value={pppoePass} 
                    onChange={(e) => setPppoePass(e.target.value)}
                    placeholder="e.g. secret123" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Router IP Address (Opsional)</label>
                  <input 
                    type="text" 
                    value={routerIp} 
                    onChange={(e) => setRouterIp(e.target.value)}
                    placeholder="e.g. 10.10.10.25" 
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Status Koneksi</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="Isolated">Terisolir (Isolir)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Paket PPPoE *</label>
                    <select 
                      value={selectedPkg} 
                      onChange={(e) => setSelectedPkg(e.target.value)}
                      className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                  {pppoePackages.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  {pppoePackages.length === 0 && (
                    <option value="">Belum ada paket PPPoE</option>
                  )}
                </select>
                </div>
                {editingId && (
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Masa Aktif</label>
                    <input 
                      type="date" 
                      value={expiryDate} 
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2 border border-surface-dim bg-transparent text-on-surface [color-scheme:light] dark:[color-scheme:dark] rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                )}
                </div>

                {(() => {
                  const selectedPackageObj = packages.find(p => p.name === selectedPkg);
                  if (!editingId && selectedPackageObj && selectedPackageObj.billing_type === 'fixed_date') {
                    const fixedDate = selectedPackageObj.fixed_date || 1;
                    const now = new Date();
                    let nextExpiry = new Date(now.getFullYear(), now.getMonth(), fixedDate);
                    if (nextExpiry <= now) {
                      nextExpiry.setMonth(nextExpiry.getMonth() + 1);
                    }
                    const diffTime = nextExpiry - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    let proratePrice = Math.round((selectedPackageObj.price / 30) * diffDays);
                    proratePrice = Math.round(proratePrice / 100) * 100;
                    if (proratePrice > selectedPackageObj.price) proratePrice = selectedPackageObj.price;

                    return (
                      <div className="mt-3 bg-indigo-50 px-3 py-2.5 rounded-lg border border-indigo-100 flex items-start gap-2">
                        <span className="material-symbols-outlined text-indigo-500 text-[18px] mt-0.5">info</span>
                        <div>
                          <p className="text-[12px] font-bold text-indigo-900">Tagihan Prorata Awal (Tgl {fixedDate})</p>
                          <p className="text-[11px] text-indigo-700 leading-tight mt-0.5">
                            Jatuh tempo pertama pada <b>{nextExpiry.toLocaleDateString('id-ID')}</b>. Estimasi tagihan awal ke pelanggan adalah <b>Rp {proratePrice.toLocaleString('id-ID')}</b> untuk pemakaian {diffDays} hari pertama.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              </div>

              <div className="px-6 py-4 flex justify-end gap-3 border-t border-surface-container bg-surface-container-low shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-dim text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary transition-colors font-label-md text-label-md shadow-sm"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
