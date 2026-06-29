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

export default function MemberList({ members, setMembers, fetchMembers, packages, addSystemLog, requestConfirm, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [macBinding, setMacBinding] = useState(true);
  const [macAddress, setMacAddress] = useState('');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [bypassHotspot, setBypassHotspot] = useState(false);

  // Search state
  const [search, setSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;


  const hotspotPackages = packages.filter(p => p.type === 'Hotspot');

  const openAddModal = () => {
    setEditingId(null);
    setErrorMsg('');
    setName('');
    setUsername('');
    setPassword('');
    setMacBinding(true);
    setMacAddress('');
    setPhone('');
    setSelectedPkg(hotspotPackages[0]?.name || '');
    setExpiryDate('');
    setBypassHotspot(false);
    setShowModal(true);
  };

  const openEditModal = (member) => {
    setEditingId(member.id);
    setErrorMsg('');
    setName(member.name);
    setUsername(member.username || '');
    setPassword(member.password || '');
    setMacBinding(!!member.macBinding);
    setMacAddress(member.macAddress || '');
    setPhone(member.phone);
    setSelectedPkg(member.package);
    setExpiryDate(member.expiry_date ? formatLocalDateForInput(member.expiry_date) : '');
    setBypassHotspot(!!member.bypassHotspot);
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) return;

    // Check duplicate name
    const isDuplicate = members.some(m => m.name.toLowerCase() === name.trim().toLowerCase() && m.id !== editingId);
    if (isDuplicate) {
      setErrorMsg('Nama member sudah terdaftar, silakan gunakan nama lain.');
      return;
    }

    const pkg = packages.find(p => p.name === selectedPkg);

    const payload = {
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      phone: phone.trim(),
      email: null,
      package_id: pkg ? pkg.id : null,
      package_name: pkg ? pkg.name : null,
      mac_binding: macBinding,
      mac_address: macBinding ? macAddress : null,
      bypass_hotspot: bypassHotspot,
      balance: 0,
      expiry_date: expiryDate || null, // calculated in backend initially, but can be overridden on edit
      is_active: true
    };

    const url = editingId ? `/api/members/${editingId}` : '/api/members';
    const method = editingId ? 'PUT' : 'POST';

    apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          fetchMembers();
          addSystemLog('SYSTEM', editingId ? `Mengubah profil member Hotspot: "${name}"` : `Mendaftarkan member Hotspot baru: "${name}"`);
          setShowModal(false);
        } else {
          setErrorMsg(json.message || (json.details ? json.details.join(', ') : json.error) || 'Gagal menyimpan member.');
        }
      })
      .catch(err => {
        setErrorMsg('Error: ' + err.message);
      });
  };

  const handleExtend = (id, memberName) => {
    requestConfirm({
      title: 'Perpanjang Paket',
      message: `Apakah Anda yakin ingin memperpanjang paket untuk member "${memberName}" selama 30 hari?`,
      confirmText: 'Ya, Perpanjang',
      variant: 'primary',
      onConfirm: () => {
        apiFetch(`/api/members/${id}/extend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: 30 })
        })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchMembers();
              addSystemLog('SYSTEM', `Memperpanjang paket member hotspot: "${memberName}"`);
            } else {
              alert(json.message || 'Gagal memperpanjang paket.');
            }
          })
          .catch(err => alert('Error: ' + err.message));
      }
    });
  };

  const handlePrint = (member) => {
    addSystemLog('SYSTEM', `Mencetak tiket member Hotspot: "${member.name}"`);
    if(addNotification) addNotification(`Menyiapkan tiket cetak untuk "${member.name}"...`, 'info');
    setTimeout(() => {
      window.print();
    }, 800);
  };

  const handleDelete = (id, memberName) => {
    requestConfirm({
      title: 'Hapus Member',
      message: `Apakah Anda yakin ingin menghapus member "${memberName}"? Semua data dan sesi terkait akan dihapus permanen.`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: () => {
        apiFetch(`/api/members/${id}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchMembers();
              addSystemLog('SYSTEM', `Menghapus Member Hotspot: "${memberName}"`);
            } else {
              alert(json.message || 'Gagal menghapus member.');
            }
          })
          .catch(err => alert('Error: ' + err.message));
      }
    });
  };

  
  const handleBulkDelete = () => {
    requestConfirm({
      title: 'Hapus Banyak Member',
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} member terpilih? Semua data dan sesi terkait akan ikut terhapus permanen.`,
      confirmText: 'Ya, Hapus Semua',
      variant: 'danger',
      onConfirm: () => {
        apiFetch('/api/members/bulk', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        })
          .then(res => res.json())
          .then(json => {
            if (json.success) {
              fetchMembers();
              addSystemLog('SYSTEM', `Menghapus ${selectedIds.length} Member Hotspot secara massal`);
              setSelectedIds([]);
            } else {
              alert(json.message || 'Gagal menghapus member.');
            }
          })
          .catch(err => alert('Error: ' + err.message));
      }
    });
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  
  const totalPages = Math.ceil(filteredMembers.length / rowsPerPage);
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Daftar Member Hotspot</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Registrasi pelanggan bulanan portal web, isi ulang saldo, dan kontrol lisensi akun.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Daftarkan Member Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-4 shadow-[0_1px_3px_rgba(77,68,227,0.03)] flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Cari nama, username, atau telp..."
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
          Total Terdaftar: <span className="font-bold text-on-surface">{members.length} Member</span>
        </div>
      </div>

      {/* Members Grid / Cards */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20 cursor-pointer"
                    checked={filteredMembers.length > 0 && selectedIds.length === filteredMembers.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredMembers.map(m => m.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th className="p-4">Nama & Kontak</th>
                <th className="p-4">Username & Password</th>
                <th className="p-4">Paket Aktif</th>
                <th className="p-4">Masa Aktif</th>
                <th className="p-4">Sesi Sinyal</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-[48px] text-surface-dim mb-3">group_off</span>
                      <p className="font-headline-sm text-[16px] font-semibold text-on-surface">Tidak ada member</p>
                      <p className="text-body-md text-label-sm mt-1">Belum ada member yang terdaftar atau ditemukan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                    {/* Name & Contact */}
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20 cursor-pointer"
                        checked={selectedIds.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, m.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== m.id));
                          }
                        }}
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-on-surface text-[14px]">{m.name}</div>
                      <div className="text-[11px] text-on-surface-variant">{m.phone}</div>
                    </td>
                    
                    <td className="p-4">
                      <div className="text-[12px] text-primary font-mono font-bold select-all">{m.username}</div>
                      <div className="text-[11px] text-on-surface-variant font-mono">{m.password || '***'}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.macAddress && (
                          <div className="text-[10px] text-outline font-mono" title="MAC Address">
                            <span className="material-symbols-outlined text-[10px] align-middle mr-1">settings_ethernet</span>
                            {m.macAddress}
                          </div>
                        )}
                        {m.bypassHotspot && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            m.bypassCreated ? 'bg-green-100 text-green-800' : 'bg-surface-variant text-on-surface-variant'
                          }`} title={m.bypassCreated ? 'Bypass aktif di MikroTik' : 'Menunggu login pertama'}>
                            {m.bypassCreated ? 'BYPASSED' : 'BYPASS ACTIVE'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Active Package */}
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                        {m.package}
                      </span>
                    </td>

                    {/* Active Period */}
                    <td className="p-4">
                      {(() => {
                        if (!m.expiryDate) return <span className="text-on-surface-variant text-[11px]">-</span>;
                        const now = new Date();
                        const exp = new Date(m.expiryDate);
                        const isExpired = exp < now;
                        const diffDays = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
                        return (
                          <div>
                            <div className={`text-[12px] font-bold ${isExpired ? 'text-error' : 'text-green-600'}`}>
                              {isExpired ? 'Kedaluwarsa' : 'Aktif'}
                            </div>
                            <div className="text-[10px] text-on-surface-variant mt-0.5">
                              s/d {m.expiryDate} {isExpired ? '' : `(${diffDays} hr)`}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Active Session badge */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${m.activeSession ? 'bg-tertiary-container animate-pulse' : 'bg-outline'}`}></span>
                        <span className={m.activeSession ? 'text-tertiary font-semibold' : 'text-on-surface-variant'}>
                          {m.activeSession ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      {m.activeSession && <div className="text-[10px] font-mono text-on-surface-variant ml-3.5">{m.ipAddress}</div>}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => handlePrint(m)}
                          className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface p-1.5 rounded transition-colors"
                          title="Cetak Tiket"
                        >
                          <span className="material-symbols-outlined text-[18px]">print</span>
                        </button>
                        <button
                          onClick={() => handleExtend(m.id, m.name)}
                          className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors"
                          title="Perpanjang Paket"
                        >
                          <span className="material-symbols-outlined text-[18px]">update</span>
                        </button>
                        <button
                          onClick={() => openEditModal(m)}
                          className="text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
                          title="Edit Member"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          className="text-error hover:bg-error-container/20 p-1.5 rounded transition-colors"
                          title="Hapus Member"
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

        {/* Pagination Controls */}
        <div className="p-4 border-t border-surface-variant flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-4">
            <span className="text-label-sm text-on-surface-variant">
              Menampilkan {Math.min(filteredMembers.length, (currentPage - 1) * rowsPerPage + 1 || 0)} - {Math.min(filteredMembers.length, currentPage * rowsPerPage)} dari {filteredMembers.length}
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
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full shadow-2xl border border-surface-variant overflow-hidden animate-slideIn">
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {editingId ? 'Edit Profil Member' : 'Registrasi Member Portal'}
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
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Nama Lengkap *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => { setName(e.target.value); setErrorMsg(''); }}
                  placeholder="e.g. Budi Santoso" 
                  required
                  className={`w-full px-3.5 py-2 border rounded-lg text-body-md focus:outline-none focus:ring-2 transition-all ${
                    errorMsg ? 'border-error focus:ring-error/20 focus:border-error' : 'border-surface-dim focus:ring-primary/20 focus:border-primary'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Username *</label>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. budisantoso" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Password *</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="e.g. rahasia123" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">No. WhatsApp / Telp *</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08123456789" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-label-md text-label-md text-on-surface-variant">Binding MAC Address</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={macBinding} 
                        onChange={(e) => setMacBinding(e.target.checked)} 
                      />
                      <div className="w-8 h-4 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <input 
                    type="text" 
                    value={macAddress} 
                    onChange={(e) => setMacAddress(e.target.value)}
                    placeholder="e.g. 00:1A:2B:3C:4D:5E" 
                    disabled={!macBinding}
                    className={`w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono ${!macBinding ? 'bg-surface-container opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 py-2.5 border border-surface-dim rounded-lg bg-surface-container-low">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface font-semibold">Bypass Hotspot (Auto IP-Binding)</label>
                  <span className="text-[11px] text-on-surface-variant">Otomatis login & bypass hotspot MikroTik saat perangkat terhubung</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={bypassHotspot} 
                    onChange={(e) => setBypassHotspot(e.target.checked)} 
                  />
                  <div className="w-8 h-4 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Pilih Paket Hotspot</label>
                      <select 
                        value={selectedPkg} 
                    onChange={(e) => setSelectedPkg(e.target.value)}
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    {hotspotPackages.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  {hotspotPackages.length === 0 && (
                    <option value="">Belum ada paket</option>
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
