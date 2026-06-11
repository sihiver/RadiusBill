import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function MemberList({ members, setMembers, packages, addSystemLog, requestConfirm, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [balance, setBalance] = useState(0);
  const [expiryDate, setExpiryDate] = useState('');

  // Search state
  const [search, setSearch] = useState('');

  const hotspotPackages = packages.filter(p => p.type === 'Hotspot');

  const openAddModal = () => {
    setEditingId(null);
    setErrorMsg('');
    setName('');
    setPhone('');
    setEmail('');
    setSelectedPkg(hotspotPackages[0]?.name || '');
    setBalance(0);
    
    // Set default expiry date to 30 days from now
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setExpiryDate(nextMonth.toISOString().split('T')[0]);
    
    setShowModal(true);
  };

  const openEditModal = (member) => {
    setEditingId(member.id);
    setErrorMsg('');
    setName(member.name);
    setPhone(member.phone);
    setEmail(member.email);
    setSelectedPkg(member.package);
    setBalance(member.balance);
    setExpiryDate(member.expiryDate);
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

    if (editingId) {
      // Edit
      setMembers(members.map(m => m.id === editingId ? {
        ...m,
        name,
        phone,
        email,
        package: selectedPkg,
        balance: Number(balance),
        expiryDate
      } : m));
      addSystemLog('SYSTEM', `Mengubah profil member Hotspot: "${name}"`);
    } else {
      // Add
      const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
      setMembers([...members, {
        id: newId,
        name,
        phone,
        email,
        package: selectedPkg,
        balance: Number(balance),
        expiryDate,
        activeSession: false,
        ipAddress: '-',
        username: name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random()*100)
      }]);
      addSystemLog('SYSTEM', `Mendaftarkan member Hotspot baru: "${name}"`);
    }
    setShowModal(false);
  };

  const handleDelete = (id, memberName) => {
    requestConfirm({
      title: 'Hapus Member',
      message: `Apakah Anda yakin ingin menghapus member "${memberName}"? Semua data dan sesi terkait akan dihapus permanen.`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: () => {
        setMembers(members.filter(m => m.id !== id));
        addSystemLog('SYSTEM', `Menghapus member Hotspot: "${memberName}"`);
        if(addNotification) addNotification(`Member "${memberName}" berhasil dihapus`, 'success');
      }
    });
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

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
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari nama, username, atau telp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-surface-dim rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="text-label-sm text-on-surface-variant">
          Total Terdaftar: <span className="font-bold text-on-surface">{members.length} Member</span>
        </div>
      </div>

      {/* Members Grid / Cards */}
      <div className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-label-sm font-label-sm text-on-surface-variant">
                <th className="p-4">Nama / Username</th>
                <th className="p-4">Kontak</th>
                <th className="p-4">Paket Aktif</th>
                <th className="p-4">Saldo Dompet</th>
                <th className="p-4">Tgl Kedaluwarsa</th>
                <th className="p-4">Sesi Sinyal</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-[13px] text-on-surface">
              {filteredMembers.length === 0 ? (
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
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                    {/* Name & User */}
                    <td className="p-4">
                      <div className="font-bold text-on-surface text-[14px]">{m.name}</div>
                      <div className="text-[11px] text-primary font-mono select-all">@{m.username}</div>
                    </td>
                    
                    {/* Contact */}
                    <td className="p-4">
                      <div>{m.phone}</div>
                      <div className="text-[11px] text-on-surface-variant">{m.email}</div>
                    </td>

                    {/* Active Package */}
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                        {m.package}
                      </span>
                    </td>

                    {/* Balance */}
                    <td className="p-4 font-mono font-semibold text-green-700">
                      Rp {m.balance.toLocaleString('id-ID')}
                    </td>

                    {/* Expiry Date */}
                    <td className="p-4 font-mono">
                      {m.expiryDate}
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
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. budi@gmail.com" 
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

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
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Isi Saldo (Rp)</label>
                  <input 
                    type="number" 
                    value={balance} 
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="e.g. 50000" 
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Tanggal Masa Kedaluwarsa *</label>
                <input 
                  type="date" 
                  value={expiryDate} 
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
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
