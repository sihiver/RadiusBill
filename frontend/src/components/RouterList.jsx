import React, { useState } from 'react';
import { createPortal } from 'react-dom';

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

  // Search filter
  const [search, setSearch] = useState('');

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
    setShowModal(true);
  };

  const openEditModal = (router) => {
    setEditingId(router.id);
    setErrorMsg('');
    setCustomerName(router.customerName);
    setPppoeUser(router.pppoeUser);
    setPppoePass(router.pppoePass);
    setRouterIp(router.routerIp);
    setSelectedPkg(router.package);
    setStatus(router.status);
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
      router_ip: routerIp.trim() || null,
      package_id: pkg ? pkg.id : null,
      package_name: pkg ? pkg.name : null,
      status: status,
      isolir: status === 'Isolated'
    };

    const url = editingId ? `/api/routers/${editingId}` : '/api/routers';
    const method = editingId ? 'PUT' : 'POST';

    fetch(url, {
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
          setErrorMsg(json.message || 'Gagal menyimpan router.');
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
        fetch(`/api/routers/${id}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchRouters();
              addSystemLog('SYSTEM', `Menghapus router PPPoE pelanggan: "${name}"`);
              if(addNotification) addNotification(`Router "${name}" deleted`, 'success');
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
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari nama pelanggan atau PPPoE user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-surface-dim rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="text-label-sm text-on-surface-variant">
          Total Router Rumah: <span className="font-bold text-on-surface">{routers.length} Instalasi</span>
        </div>
      </div>

      {/* Routers Table */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4">Pelanggan Rumah</th>
                <th className="p-4">PPPoE Credentials</th>
                <th className="p-4">Router IP Address</th>
                <th className="p-4">Paket Langganan</th>
                <th className="p-4">Status Koneksi</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {filteredRouters.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-on-surface-variant italic">
                    Tidak ada router PPPoE ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRouters.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-lowest/50 transition-colors">
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
                        {r.package}
                      </span>
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

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1.5">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full shadow-2xl border border-surface-variant overflow-hidden animate-slideIn">
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
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

            <form onSubmit={handleSave} className="p-6 space-y-4">
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

              <div className="flex justify-end gap-3 pt-3 border-t border-surface-container">
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
