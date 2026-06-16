import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';

export default function ResellerManagement() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    balance: 0,
    topup_balance: 0
  });

  const fetchResellers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/resellers');
      const json = await res.json();
      if (json.success) {
        setResellers(json.data);
      } else {
        setError(json.error || 'Gagal memuat data reseller');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat memuat data reseller');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResellers();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          balance: Number(formData.balance)
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsAddModalOpen(false);
        setFormData({ username: '', password: '', balance: 0, topup_balance: 0 });
        fetchResellers();
      } else {
        alert(json.error || 'Gagal menambahkan reseller');
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReseller) return;
    try {
      const body = {};
      if (formData.password) body.password = formData.password;
      
      const res = await apiFetch(`/api/resellers/${selectedReseller.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        setIsEditModalOpen(false);
        setFormData({ username: '', password: '', balance: 0, topup_balance: 0 });
        setSelectedReseller(null);
        fetchResellers();
      } else {
        alert(json.error || 'Gagal mengubah password');
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    }
  };

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReseller) return;
    try {
      const res = await apiFetch(`/api/resellers/${selectedReseller.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topup_balance: Number(formData.topup_balance)
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsTopupModalOpen(false);
        setFormData({ username: '', password: '', balance: 0, topup_balance: 0 });
        setSelectedReseller(null);
        fetchResellers();
      } else {
        alert(json.error || 'Gagal melakukan top-up');
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus reseller ini?')) return;
    try {
      const res = await apiFetch(`/api/resellers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchResellers();
      } else {
        alert(json.error || 'Gagal menghapus reseller');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menghapus reseller');
    }
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Kelola Reseller</h2>
          <p className="text-on-surface-variant text-sm mt-1">Manajemen agen voucher & saldo</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ username: '', password: '', balance: 0, topup_balance: 0 });
            setIsAddModalOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tambah Reseller
        </button>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      <div className="bg-surface-container rounded-3xl overflow-hidden shadow-sm border border-outline-variant/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant/30">
              <tr>
                <th className="px-6 py-4 font-medium">Username</th>
                <th className="px-6 py-4 font-medium">Saldo Dompet</th>
                <th className="px-6 py-4 font-medium">Dibuat Pada</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-3xl mb-2">refresh</span>
                    <p>Memuat data...</p>
                  </td>
                </tr>
              ) : resellers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-on-surface-variant">
                    Belum ada data reseller.
                  </td>
                </tr>
              ) : (
                resellers.map(reseller => (
                  <tr key={reseller.id} className="hover:bg-surface-container-highest/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-on-surface">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">storefront</span>
                        {reseller.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-primary">
                      Rp {Number(reseller.balance).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {new Date(reseller.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedReseller(reseller);
                            setFormData({ ...formData, topup_balance: 0 });
                            setIsTopupModalOpen(true);
                          }}
                          className="p-2 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-lg transition-colors"
                          title="Top Up Saldo"
                        >
                          <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedReseller(reseller);
                            setFormData({ ...formData, password: '' });
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-tertiary hover:bg-tertiary-container hover:text-on-tertiary-container rounded-lg transition-colors"
                          title="Ubah Password"
                        >
                          <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(reseller.id)}
                          className="p-2 text-error hover:bg-error-container hover:text-on-error-container rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
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

      {/* Modal Add */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-on-surface">Tambah Reseller</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1 ml-1">Username</label>
                <input 
                  type="text" required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. agen02"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1 ml-1">Password</label>
                <input 
                  type="password" required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1 ml-1">Saldo Awal (Rp)</label>
                <input 
                  type="number" required min="0"
                  value={formData.balance}
                  onChange={e => setFormData({...formData, balance: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="0"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-medium text-on-surface-variant hover:bg-surface-variant/50 transition-colors">Batal</button>
                <button type="submit" className="flex-1 bg-primary text-on-primary px-4 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Topup */}
      {isTopupModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-on-surface">Top Up Saldo</h3>
              <button onClick={() => setIsTopupModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleTopupSubmit} className="p-6 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-on-surface-variant mb-1">Reseller: <span className="font-medium text-on-surface">{selectedReseller.username}</span></p>
                <p className="text-sm text-on-surface-variant">Saldo Saat Ini: <span className="font-medium text-primary">Rp {Number(selectedReseller.balance).toLocaleString('id-ID')}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1 ml-1">Jumlah Top Up (Rp)</label>
                <input 
                  type="number" required min="1000" step="1000"
                  value={formData.topup_balance}
                  onChange={e => setFormData({...formData, topup_balance: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Misal: 50000"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsTopupModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-medium text-on-surface-variant hover:bg-surface-variant/50 transition-colors">Batal</button>
                <button type="submit" className="flex-1 bg-primary text-on-primary px-4 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm">Top Up</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Password */}
      {isEditModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-on-surface">Ubah Password</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-on-surface-variant">Ubah password untuk <span className="font-medium text-on-surface">{selectedReseller.username}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1 ml-1">Password Baru</label>
                <input 
                  type="password" required minLength="6"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-medium text-on-surface-variant hover:bg-surface-variant/50 transition-colors">Batal</button>
                <button type="submit" className="flex-1 bg-primary text-on-primary px-4 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
