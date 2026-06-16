import React, { useState, useEffect } from 'react';

export default function DashboardOverview({ 
  packages, 
  vouchers, 
  members, 
  routers, 
  logs, 
  clearLogs,
  isSyncing,
  fetchRadiusLogs
}) {
  const [chartFilter, setChartFilter] = useState('all'); // 'all', 'hotspot', 'pppoe'
  const [hoveredBar, setHoveredBar] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    if (typeof fetchRadiusLogs === 'function') {
      fetchRadiusLogs();
    }
    const interval = setInterval(() => {
      fetchStats();
      if (typeof fetchRadiusLogs === 'function') {
        fetchRadiusLogs();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Calculate dynamic stats
  const activeVouchersCount = vouchers.filter(v => v.status === 'Active').length;
  const activeMembersCount = members.filter(m => m.activeSession).length;
  const onlineRoutersCount = routers.filter(r => r.status === 'Online').length;
  const totalRoutersCount = routers.length;

  // Let's compute a mock revenue sum
  // Packages prices: Hotspot averages 5k-25k, PPPoE averages 100k-250k
  // Sum active vouchers price + active members package price + router package price
  const calculateTotalRevenue = () => {
    let total = 0;
    // Active vouchers revenue
    vouchers.forEach(v => {
      if (v.status === 'Active') {
        const pkg = packages.find(p => p.name === v.package);
        total += pkg ? pkg.price : 5000;
      }
    });
    // Active members (monthly)
    members.forEach(m => {
      const pkg = packages.find(p => p.name === m.package);
      total += pkg ? pkg.price : 25000;
    });
    // Online Routers (PPPoE monthly)
    routers.forEach(r => {
      if (r.status !== 'Isolated') {
        const pkg = packages.find(p => p.name === r.package);
        total += pkg ? pkg.price : 100000;
      }
    });
    return total;
  };

  const currentRevenue = calculateTotalRevenue();

  // Chart data configuration based on filter
  const generateChartData = (trendData) => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const result = { all: [], hotspot: [], pppoe: [] };
    
    // Generate dates for the last 7 days
    const last7Dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Dates.push(d.toISOString().split('T')[0]); // Local time ISO
    }

    last7Dates.forEach(dateStr => {
      const d = new Date(dateStr);
      const dayName = days[d.getDay()];

      let hotspotAmt = 0;
      let pppoeAmt = 0;

      if (trendData) {
        trendData.forEach(row => {
          if (row.date === dateStr) {
            if (row.type === 'voucher' || row.type === 'member') {
              hotspotAmt += Number(row.amount);
            } else if (row.type === 'router' || row.type === 'pppoe') {
              pppoeAmt += Number(row.amount);
            }
          }
        });
      }

      const allAmt = hotspotAmt + pppoeAmt;
      const formatLabel = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

      result.all.push({ day: dayName, amt: allAmt, label: formatLabel(allAmt) });
      result.hotspot.push({ day: dayName, amt: hotspotAmt, label: formatLabel(hotspotAmt) });
      result.pppoe.push({ day: dayName, amt: pppoeAmt, label: formatLabel(pppoeAmt) });
    });

    return result;
  };

  const currentChartData = generateChartData(stats?.revenueTrend);
  const activeChart = currentChartData[chartFilter];

  // Dynamic Y-axis maximum
  const maxAmtInChart = Math.max(...activeChart.map(i => i.amt), 0);
  
  // Compute nice scale
  let maxAxisValue = 100000; // default minimum scale 100k
  if (maxAmtInChart > 0) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxAmtInChart)));
    // If leading digit is small, snap to 4, 8 etc for cleaner 4-divisions
    const leading = maxAmtInChart / magnitude;
    let multiplier = Math.ceil(leading);
    if (multiplier <= 2) multiplier = 2; // steps of 0.5
    else if (multiplier <= 4) multiplier = 4; // steps of 1
    else if (multiplier <= 8) multiplier = 8; // steps of 2
    else multiplier = 10;
    
    maxAxisValue = multiplier * magnitude;
  }
  
  const compactFormat = (val) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val);

  return (
    <div className="w-full space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Dashboard Overview</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Real-time network, customer usage, and billing metrics.</p>
        </div>
        <div className="flex items-center gap-2 text-label-sm font-label-sm text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full self-start sm:self-center">
          <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container animate-ping"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container absolute"></span>
          Live Updates Active
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pendapatan */}
        <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.04)] border border-surface-variant/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container/5 rounded-bl-full -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-lg bg-tertiary-container/10 flex items-center justify-center text-tertiary-container">
              <span className="material-symbols-outlined">payments</span>
            </div>
            {stats && stats.revenue && (
              <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded flex items-center gap-1 ${
                stats.revenue.growth_percentage >= 0 
                  ? 'text-tertiary-container bg-tertiary-container/10' 
                  : 'text-error bg-error-container'
              }`}>
                <span className="material-symbols-outlined text-[14px]">
                  {stats.revenue.growth_percentage >= 0 ? 'arrow_upward' : 'arrow_downward'}
                </span>
                {Math.abs(stats.revenue.growth_percentage).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="relative z-10">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Estimasi Pendapatan (Bulan Ini)</h3>
            {isSyncing ? (
              <div className="h-10 bg-surface-variant animate-pulse rounded w-2/3 mt-2"></div>
            ) : (
              <p className="font-display-lg text-display-lg text-on-surface flex items-baseline gap-1">
                {stats && stats.revenue
                  ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(stats.revenue.this_month)
                  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(currentRevenue)}
              </p>
            )}
          </div>
        </div>

        {/* Voucher Aktif */}
        <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.04)] border border-surface-variant/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined">confirmation_number</span>
            </div>
            <span className="font-label-sm text-label-sm text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              Eceran
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Voucher Hotspot Aktif</h3>
            {isSyncing ? (
              <div className="h-10 bg-surface-variant animate-pulse rounded w-1/2 mt-2"></div>
            ) : (
              <p className="font-display-lg text-display-lg text-on-surface">
                {stats && stats.vouchers ? stats.vouchers.active_vouchers : activeVouchersCount} <span className="font-body-md text-body-md text-on-surface-variant">dari {stats && stats.vouchers ? (Number(stats.vouchers.active_vouchers) + Number(stats.vouchers.unused_vouchers)) : vouchers.length}</span>
              </p>
            )}
          </div>
        </div>

        {/* Member Hotspot Aktif */}
        <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.04)] border border-surface-variant/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined">wifi</span>
            </div>
            <span className="font-label-sm text-label-sm text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
              Bulanan Web
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Member Hotspot Aktif</h3>
            {isSyncing ? (
              <div className="h-10 bg-surface-variant animate-pulse rounded w-1/2 mt-2"></div>
            ) : (
              <p className="font-display-lg text-display-lg text-on-surface">
                {stats && stats.members ? stats.members.online_members : activeMembersCount} <span className="font-body-md text-body-md text-on-surface-variant">dari {stats && stats.members ? stats.members.total_members : members.length}</span>
              </p>
            )}
          </div>
        </div>

        {/* Router PPPoE Online */}
        <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.04)] border border-surface-variant/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">router</span>
            </div>
            <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
              (stats && stats.routers ? (stats.routers.online_routers / (stats.routers.total_routers || 1)) : (onlineRoutersCount / (totalRoutersCount || 1))) >= 0.9 
                ? 'text-tertiary-container bg-tertiary-fixed-dim/20' 
                : 'text-error bg-error-container'
            }`}>
              {((stats && stats.routers ? (stats.routers.online_routers / (stats.routers.total_routers || 1)) : (onlineRoutersCount / (totalRoutersCount || 1))) * 100).toFixed(0)}% Uptime
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Router PPPoE Aktif</h3>
            {isSyncing ? (
              <div className="h-10 bg-surface-variant animate-pulse rounded w-1/2 mt-2"></div>
            ) : (
              <p className="font-display-lg text-display-lg text-on-surface">
                {stats && stats.routers ? stats.routers.online_routers : onlineRoutersCount}<span className="font-body-md text-body-md text-on-surface-variant ml-1">/ {stats && stats.routers ? stats.routers.total_routers : totalRoutersCount}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Dashboard Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Chart */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.04)] border border-surface-variant/50 flex flex-col">
          <div className="p-4 border-b border-surface-variant/50 flex justify-between items-center bg-surface-container-lowest rounded-t-xl">
            <div className="flex flex-col">
              <h3 className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">Revenue Trend (7 Days)</h3>
              <p className="text-label-sm text-on-surface-variant mt-0.5">Estimasi pendapatan harian (Juta Rupiah)</p>
            </div>
            
            {/* Filter buttons */}
            <div className="flex bg-surface-container rounded-lg p-0.5">
              <button 
                onClick={() => setChartFilter('all')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  chartFilter === 'all' 
                    ? 'bg-surface-container-lowest text-primary shadow-sm' 
                    : 'text-on-secondary-container hover:text-on-surface'
                }`}
              >
                Semua
              </button>
              <button 
                onClick={() => setChartFilter('hotspot')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  chartFilter === 'hotspot' 
                    ? 'bg-surface-container-lowest text-primary shadow-sm' 
                    : 'text-on-secondary-container hover:text-on-surface'
                }`}
              >
                Hotspot
              </button>
              <button 
                onClick={() => setChartFilter('pppoe')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  chartFilter === 'pppoe' 
                    ? 'bg-surface-container-lowest text-primary shadow-sm' 
                    : 'text-on-secondary-container hover:text-on-surface'
                }`}
              >
                PPPoE
              </button>
            </div>
          </div>
          
          <div className="p-card-padding flex-1 relative min-h-[300px] chart-grid flex items-end">
            {/* Simulated Area Chart */}
            <div className="w-full h-full relative flex items-end justify-between px-2 pb-6 pt-10">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] font-label-sm text-outline pr-2 pb-6">
                <span>{compactFormat(maxAxisValue)}</span>
                <span>{compactFormat(maxAxisValue * 0.75)}</span>
                <span>{compactFormat(maxAxisValue * 0.5)}</span>
                <span>{compactFormat(maxAxisValue * 0.25)}</span>
                <span>0</span>
              </div>
              
              {/* Bars/Area points */}
              <div className="flex-1 flex justify-around items-end h-full pl-8 z-10 gap-2">
                {activeChart.map((item, idx) => {
                  const percentage = Math.min((item.amt / maxAxisValue) * 100, 100);
                  return (
                    <div 
                      key={idx}
                      className="w-10 rounded-t-lg relative group cursor-pointer flex justify-center transition-all bg-primary hover:brightness-110"
                      style={{ height: `${percentage}%` }}
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* Tooltip */}
                      <div className={`absolute -top-10 bg-inverse-surface text-inverse-on-surface text-[10px] font-mono px-2 py-1 rounded shadow-lg transition-opacity duration-200 z-30 whitespace-nowrap ${
                        hoveredBar === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}>
                        {item.label}
                      </div>
                      
                      {/* Bar label for values */}
                      <span className="text-[10px] font-semibold text-primary absolute -top-5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {compactFormat(item.amt)}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 w-full flex justify-around pl-10 pr-2 text-label-sm font-label-sm text-outline">
                {activeChart.map((item, idx) => (
                  <span key={idx} className="w-10 text-center">{item.day}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Interface Log */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(77,68,227,0.04)] border border-surface-variant/50 flex flex-col h-[400px]">
          <div className="p-4 border-b border-surface-variant/50 flex justify-between items-center bg-surface-container-lowest rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-outline">terminal</span>
              <h3 className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">Interface Log</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={clearLogs}
                title="Clear Logs"
                className="p-1 hover:bg-surface-container rounded text-outline hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
              <span className="font-label-sm text-label-sm bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">FreeRADIUS</span>
            </div>
          </div>
          
          <div className="p-3 flex-1 overflow-y-auto bg-surface-container-lowest text-on-surface font-mono text-[12px] leading-relaxed rounded-b-xl flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-surface-variant">
            {logs.length === 0 ? (
              <div className="text-outline italic text-center mt-10">Mendengarkan permintaan autentikasi FreeRADIUS...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="group flex items-center gap-3 px-3 py-2 hover:bg-surface-container rounded-lg transition-colors border border-transparent hover:border-surface-variant/50">
                  <span className="text-[11px] font-mono text-on-surface-variant font-medium w-14 shrink-0">{log.time}</span>
                  
                  {log.type === 'AUTH' && (
                    <>
                      <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[14px] text-on-primary-container">check_circle</span>
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-semibold text-on-surface">{log.user}</span>
                        <span className="text-on-surface-variant ml-1.5 text-[11px]">berhasil terhubung <span className="opacity-70">({log.ip})</span></span>
                      </div>
                    </>
                  )}
                  {log.type === 'REJECT' && (
                    <>
                      <div className="w-6 h-6 rounded-full bg-error-container flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[14px] text-on-error-container">cancel</span>
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-semibold text-on-surface">{log.user}</span>
                        <span className="text-error ml-1.5 text-[11px]">Gagal: {log.reason}</span>
                      </div>
                    </>
                  )}
                  {log.type === 'ACCT' && (
                    <>
                      <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[14px] text-on-secondary-container">
                          {log.action === 'Start' ? 'login' : log.action === 'Stop' ? 'logout' : 'sync'}
                        </span>
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-semibold text-on-surface">{log.user}</span>
                        <span className="text-on-surface-variant ml-1.5 text-[11px]">
                          sesi {log.action === 'Start' ? 'dimulai' : log.action === 'Stop' ? 'berakhir' : 'diperbarui'}
                        </span>
                      </div>
                    </>
                  )}
                  {log.type === 'SYSTEM' && (
                    <>
                      <div className="w-6 h-6 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">info</span>
                      </div>
                      <div className="flex-1 truncate text-outline italic text-[11px]">
                        {log.message}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
