import React, { useState } from 'react';

export default function PackageManagement({ packages, setPackages, addSystemLog, requestConfirm, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('Hotspot'); // Hotspot, PPPoE
  const [speedUpload, setSpeedUpload] = useState('2 Mbps');
  const [speedDownload, setSpeedDownload] = useState('5 Mbps');
  const [validity, setValidity] = useState('30 Hari');
  const [price, setPrice] = useState(50000);
  const [description, setDescription] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setErrorMsg('');
    setName('');
    setType('Hotspot');
    setSpeedUpload('2 Mbps');
    setSpeedDownload('5 Mbps');
    setValidity('30 Hari');
    setPrice(50000);
    setDescription('');
    setShowModal(true);
  };

  const openEditModal = (pkg) => {
    setEditingId(pkg.id);
    setErrorMsg('');
    setName(pkg.name);
    setType(pkg.type);
    setSpeedUpload(pkg.speedUpload);
    setSpeedDownload(pkg.speedDownload);
    setValidity(pkg.validity);
    setPrice(pkg.price);
    setDescription(pkg.description || '');
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) return;

    // Check duplicate name
    const isDuplicate = packages.some(p => p.name.toLowerCase() === name.trim().toLowerCase() && p.id !== editingId);
    if (isDuplicate) {
      setErrorMsg('Nama paket sudah digunakan, silakan pilih nama lain.');
      return;
    }

    if (editingId) {
      // Edit
      setPackages(packages.map(p => p.id === editingId ? {
        id: editingId,
        name,
        type,
        speedUpload,
        speedDownload,
        validity,
        price: Number(price),
        description
      } : p));
      addSystemLog('SYSTEM', `Mengubah paket: "${name}"`);
    } else {
      // Add new
      const newId = packages.length > 0 ? Math.max(...packages.map(p => p.id)) + 1 : 1;
      setPackages([...packages, {
        id: newId,
        name,
        type,
        speedUpload,
        speedDownload,
        validity,
        price: Number(price),
        description
      }]);
      addSystemLog('SYSTEM', `Menambahkan paket baru: "${name}"`);
    }
    setShowModal(false);
  };

  const handleDelete = (id, pkgName) => {
    requestConfirm({
      title: 'Hapus Paket Bandwidth',
      message: `Apakah Anda yakin ingin menghapus paket "${pkgName}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: () => {
        setPackages(packages.filter(p => p.id !== id));
        addSystemLog('SYSTEM', `Menghapus paket ID ${id}`);
        if(addNotification) addNotification(`Paket "${pkgName}" berhasil dihapus`, 'success');
      }
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Pengelolaan Paket & Bandwidth</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Konfigurasi bandwidth limit, harga, dan masa aktif paket FreeRADIUS.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tambah Paket Baru
        </button>
      </div>

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div 
            key={pkg.id} 
            className="bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.03)] flex flex-col justify-between hover:shadow-md transition-all duration-200 relative overflow-hidden group"
          >
            {/* Top Accent Strip */}
            <div className={`absolute top-0 left-0 w-full h-1.5 ${
              pkg.type === 'Hotspot' ? 'bg-amber-500' : 'bg-primary'
            }`}></div>

            <div>
              {/* Type Badge & Price */}
              <div className="flex justify-between items-center mb-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  pkg.type === 'Hotspot' 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-primary-fixed text-on-primary-fixed-variant'
                }`}>
                  {pkg.type}
                </span>
                <span className="font-display-lg text-[22px] font-bold text-on-surface">
                  <span className="text-body-md text-on-surface-variant font-normal">Rp</span> {pkg.price.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-headline-sm text-[18px] text-on-surface mb-2 font-bold group-hover:text-primary transition-colors">{pkg.name}</h3>
              {pkg.description && (
                <p className="text-body-md text-label-sm text-on-surface-variant line-clamp-2 mb-4">{pkg.description}</p>
              )}

              {/* Specs Grid */}
              <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-2.5 rounded-lg mb-6 border border-surface-container text-center text-label-sm">
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-semibold">Download</p>
                  <p className="font-bold text-on-surface flex items-center justify-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-green-600">download</span>
                    {pkg.speedDownload}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-semibold">Upload</p>
                  <p className="font-bold text-on-surface flex items-center justify-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-blue-600">upload</span>
                    {pkg.speedUpload}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase font-semibold">Masa Aktif</p>
                  <p className="font-bold text-on-surface flex items-center justify-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-purple-600">schedule</span>
                    {pkg.validity}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-surface-container pt-3">
              <button 
                onClick={() => openEditModal(pkg)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-on-secondary-container hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </button>
              <button 
                onClick={() => handleDelete(pkg.id, pkg.name)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-error hover:bg-error-container/10 transition-colors font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full shadow-2xl border border-surface-variant overflow-hidden animate-slideIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {editingId ? 'Edit Paket Bandwidth' : 'Tambah Paket Bandwidth'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {errorMsg && (
                <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {errorMsg}
                </div>
              )}
              
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Nama Paket *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => { setName(e.target.value); setErrorMsg(''); }}
                  placeholder="e.g. Voucher 5 Hours atau PPPoE Home 10M" 
                  required
                  className={`w-full px-3.5 py-2 border rounded-lg text-body-md focus:outline-none focus:ring-2 transition-all ${
                    errorMsg ? 'border-error focus:ring-error/20 focus:border-error' : 'border-surface-dim focus:ring-primary/20 focus:border-primary'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Tipe Paket</label>
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="Hotspot">Hotspot (Voucher/Member)</option>
                    <option value="PPPoE">PPPoE (Router Rumah)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Harga (Rupiah) *</label>
                  <input 
                    type="number" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 5000" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Download Speed</label>
                  <input 
                    type="text" 
                    value={speedDownload} 
                    onChange={(e) => setSpeedDownload(e.target.value)}
                    placeholder="e.g. 5 Mbps" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Upload Speed</label>
                  <input 
                    type="text" 
                    value={speedUpload} 
                    onChange={(e) => setSpeedUpload(e.target.value)}
                    placeholder="e.g. 2 Mbps" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Masa Aktif</label>
                  <input 
                    type="text" 
                    value={validity} 
                    onChange={(e) => setValidity(e.target.value)}
                    placeholder="e.g. 30 Hari, 1 Hari" 
                    required
                    className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Deskripsi Paket</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  rows="2"
                  placeholder="Keterangan opsional..." 
                  className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                />
              </div>

              {/* Modal Footer */}
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
        </div>
      )}
    </div>
  );
}
