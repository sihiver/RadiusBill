import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { LogOut, User, Package, Calendar, Wifi, CreditCard, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function ClientDashboard({ onLogout }) {
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, invoicesRes] = await Promise.all([
        apiFetch('/api/client/me', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('rtrwnet_client_token')}` }
        }),
        apiFetch('/api/client/invoices', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('rtrwnet_client_token')}` }
        })
      ]);

      if (profileRes.ok && invoicesRes.ok) {
        const profileData = await profileRes.json();
        const invoicesData = await invoicesRes.json();
        setProfile(profileData.data);
        setInvoices(invoicesData.data);
      } else if (profileRes.status === 401 || profileRes.status === 403) {
        onLogout(); // Token expired or invalid
      }
    } catch (err) {
      console.error('Failed to fetch client data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setProcessing(true);
    try {
      const res = await apiFetch('/api/client/invoices', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('rtrwnet_client_token')}`
        },
        body: JSON.stringify({ payment_method: 'MOCK_QRIS' })
      });
      const data = await res.json();
      if (data.success) {
        // In a real scenario, we redirect to Tripay/Midtrans checkout URL
        // window.location.href = data.data.checkout_url;
        
        // For MOCK, we just alert and simulate the webhook
        const confirmed = window.confirm(`Tagihan dibuat!\n\nNo: ${data.data.invoice_number}\nTotal: Rp ${data.data.amount.toLocaleString('id-ID')}\n\nKlik OK untuk "MENSIMULASIKAN" pembayaran berhasil via Webhook.`);
        
        if (confirmed) {
          await simulateWebhook(data.data.invoice_number);
        } else {
          fetchData(); // Just refresh list
        }
      } else {
        alert(data.message || 'Gagal membuat tagihan');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setProcessing(false);
    }
  };

  const simulateWebhook = async (invoiceNumber) => {
    try {
      const res = await fetch('http://localhost:3001/api/webhooks/payment/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_number: invoiceNumber })
      });
      const data = await res.json();
      if (data.success) {
        alert('Pembayaran BERHASIL! Layanan Anda telah diperpanjang.');
        fetchData();
      } else {
        alert('Simulasi pembayaran gagal: ' + data.message);
      }
    } catch (err) {
      alert('Gagal menghubungi webhook');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) return null;

  const isExpired = new Date(profile.expiry_date) < new Date();
  const isIsolated = profile.isolir || isExpired; // members might not have isolir field, but they expire

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID': return <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">LUNAS</span>;
      case 'UNPAID': return <span className="px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">BELUM BAYAR</span>;
      case 'EXPIRED': return <span className="px-2.5 py-1 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-full">KEDALUWARSA</span>;
      default: return <span className="px-2.5 py-1 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Client Portal</span>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-transparent hover:border-slate-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Status Banner */}
        {isIsolated && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start space-x-4">
            <div className="bg-red-500/20 p-2 rounded-full shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-red-400 font-bold text-lg">Layanan Terisolir / Habis Masa Aktif</h3>
              <p className="text-red-300/80 mt-1">Koneksi internet Anda saat ini ditangguhkan. Silakan lakukan pembayaran tagihan untuk mengaktifkan kembali layanan Anda secara otomatis.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl shadow-black/20">
              <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <User className="w-5 h-5 mr-3 text-cyan-400" />
                  Informasi Layanan
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-400">Nama Pelanggan</p>
                    <p className="text-lg font-semibold text-white">{profile.name || profile.customer_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-400">Username / ID</p>
                    <p className="text-lg font-semibold text-white">{profile.username || profile.pppoe_user}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-400 flex items-center">
                      <Package className="w-4 h-4 mr-1.5" /> Paket Aktif
                    </p>
                    <p className="text-lg font-semibold text-cyan-400">{profile.pkg_name || profile.package_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-400 flex items-center">
                      <Calendar className="w-4 h-4 mr-1.5" /> Masa Aktif Hingga
                    </p>
                    <p className={`text-lg font-semibold ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                      {profile.expiry_date ? new Date(profile.expiry_date).toLocaleDateString('id-ID', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                      }) : 'Belum ditentukan'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices List */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl shadow-black/20">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Clock className="w-5 h-5 mr-3 text-cyan-400" />
                  Riwayat Tagihan
                </h2>
              </div>
              <div className="divide-y divide-slate-700">
                {invoices.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    Belum ada riwayat tagihan.
                  </div>
                ) : (
                  invoices.map(inv => (
                    <div key={inv.id} className="p-6 hover:bg-slate-750 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="font-bold text-white">{inv.invoice_number}</span>
                          {getStatusBadge(inv.status)}
                        </div>
                        <p className="text-sm text-slate-400">{inv.description}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Dibuat: {new Date(inv.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between items-center sm:items-end">
                        <span className="text-lg font-bold text-white">Rp {inv.amount.toLocaleString('id-ID')}</span>
                        {inv.status === 'UNPAID' && (
                          <button 
                            onClick={() => window.open(inv.checkout_url, '_blank')}
                            className="mt-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
                          >
                            Lanjutkan Bayar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Payment Card */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-6 shadow-xl shadow-cyan-500/20 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 text-white/10">
                <CreditCard className="w-40 h-40" />
              </div>
              <div className="relative z-10">
                <h3 className="text-cyan-100 font-medium mb-1">Tagihan Bulan Ini</h3>
                <div className="text-3xl font-bold text-white mb-6">
                  Rp {(profile.price || 0).toLocaleString('id-ID')}
                </div>
                
                <p className="text-sm text-cyan-100/80 mb-6">
                  Lakukan pembayaran sebelum <br/>
                  <strong className="text-white">
                    {profile.expiry_date ? new Date(profile.expiry_date).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    }) : '-'}
                  </strong>
                  <br/>agar koneksi tidak terputus.
                </p>

                <button
                  onClick={handlePay}
                  disabled={processing}
                  className="w-full bg-white text-cyan-700 hover:bg-cyan-50 font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center"
                >
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>Bayar Sekarang</>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-white font-bold mb-4">Cara Pembayaran</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2 shrink-0" />
                  Klik tombol <strong>Bayar Sekarang</strong> di atas.
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2 shrink-0" />
                  Pilih metode pembayaran (QRIS, Virtual Account, Alfamart, dll).
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2 shrink-0" />
                  Lakukan pembayaran sesuai instruksi.
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2 shrink-0" />
                  Sistem akan otomatis mencatat dan memperpanjang masa aktif Anda dalam hitungan detik.
                </li>
              </ul>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
