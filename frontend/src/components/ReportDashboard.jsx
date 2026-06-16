import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';

const ReportDashboard = ({ addNotification }) => {
  const [summary, setSummary] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Month filter state (defaults to current YYYY-MM)
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  
  // Pagination state for revenue table
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fetchReports = async () => {
    setLoading(true);
    try {
      const qs = selectedMonth ? `?month=${selectedMonth}` : '';
      const [sumRes, revRes] = await Promise.all([
        apiFetch(`/api/reports/summary${qs}`).then(r => r.json()),
        apiFetch(`/api/reports/revenue${qs}`).then(r => r.json())
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (revRes.success) {
        setRevenueData(revRes.data);
        setCurrentPage(1); // Reset page on refresh
      }
    } catch (err) {
      addNotification('error', 'Gagal memuat laporan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedMonth]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-outline text-sm">Memuat data laporan...</p>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  // Pagination calculations
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = revenueData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(revenueData.length / rowsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-y-auto">
      <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header with Filter */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-bold text-on-surface">Laporan Keuangan</h1>
            <p className="text-body-lg text-on-surface-variant mt-2">
              Ringkasan pendapatan dari penjualan voucher, member, dan router PPPoE.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-label-md font-semibold text-on-surface-variant">Pilih Bulan:</label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-surface-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-primary-container/20 border border-primary/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                <h3 className="font-label-md text-on-surface-variant">Pendapatan Bulan {selectedMonth}</h3>
              </div>
              <p className="text-display-sm font-bold text-primary">{formatCurrency(summary.revenue_this_month)}</p>
            </div>
            
            <div className="bg-tertiary-container/20 border border-tertiary/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-tertiary">today</span>
                <h3 className="font-label-md text-on-surface-variant">Pendapatan Hari Ini</h3>
              </div>
              <p className="text-display-sm font-bold text-tertiary">{formatCurrency(summary.revenue_today)}</p>
            </div>

            <div className="bg-secondary-container/20 border border-secondary/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-secondary">confirmation_number</span>
                <h3 className="font-label-md text-on-surface-variant">Voucher Aktif</h3>
              </div>
              <p className="text-display-sm font-bold text-secondary">{summary.active_vouchers}</p>
            </div>

            <div className="bg-surface-container border border-surface-variant rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-outline">group</span>
                <h3 className="font-label-md text-on-surface-variant">Klien Berlangganan</h3>
              </div>
              <p className="text-display-sm font-bold text-on-surface">
                {parseInt(summary.active_members) + parseInt(summary.active_routers)}
              </p>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-surface border border-surface-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-6 border-b border-surface-variant flex items-center justify-between">
            <h2 className="text-title-lg font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined">receipt_long</span>
              Riwayat Pendapatan Harian ({selectedMonth === currentMonthStr ? '30 Hari Terakhir' : `Bulan ${selectedMonth}`})
            </h2>
            <button 
              onClick={fetchReports}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-surface-variant">
                  <th className="p-4 font-label-md text-on-surface-variant font-semibold">Tanggal</th>
                  <th className="p-4 font-label-md text-on-surface-variant font-semibold">Tipe</th>
                  <th className="p-4 font-label-md text-on-surface-variant font-semibold text-right">Total Transaksi</th>
                  <th className="p-4 font-label-md text-on-surface-variant font-semibold text-right">Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {revenueData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-outline">Belum ada transaksi di periode ini.</td>
                  </tr>
                ) : (
                  currentRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="p-4 text-body-md text-on-surface">
                        {new Date(row.date + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                          row.type === 'voucher' ? 'bg-primary-container text-on-primary-container' : 
                          row.type === 'member' ? 'bg-tertiary-container text-on-tertiary-container' : 
                          'bg-secondary-container text-on-secondary-container'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="p-4 text-body-md text-on-surface text-right">{row.transaction_count}</td>
                      <td className="p-4 text-title-md font-semibold text-on-surface text-right">
                        {formatCurrency(row.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {revenueData.length > 0 && (
            <div className="p-4 border-t border-surface-variant flex items-center justify-between bg-surface-container-lowest">
              <span className="text-body-sm text-on-surface-variant">
                Menampilkan <span className="font-semibold text-on-surface">{indexOfFirstRow + 1}</span> hingga <span className="font-semibold text-on-surface">{Math.min(indexOfLastRow, revenueData.length)}</span> dari <span className="font-semibold text-on-surface">{revenueData.length}</span> baris
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-surface-variant hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="text-label-md font-semibold text-on-surface px-2">
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-lg border border-surface-variant hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReportDashboard;
