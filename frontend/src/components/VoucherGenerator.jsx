import React, { useState } from 'react';

export default function VoucherGenerator({ packages, vouchers, setVouchers, addSystemLog }) {
  // Generator settings
  const hotspotPackages = packages.filter(p => p.type === 'Hotspot');
  const [selectedPkgId, setSelectedPkgId] = useState(hotspotPackages[0]?.id || '');
  const [quantity, setQuantity] = useState(10);
  const [codeLength, setCodeLength] = useState(6);
  const [prefix, setPrefix] = useState('RW-');
  const [format, setFormat] = useState('same'); // 'same' (user=pass), 'up' (user & pass separate)
  const [macBinding, setMacBinding] = useState(false); // MAC Binding toggle

  // Session state to show recently generated vouchers
  const [newlyGenerated, setNewlyGenerated] = useState([]);

  // Generate random characters
  const generateRandomCode = (length) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars like O, 0, I, 1
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    const pkg = packages.find(p => p.id === Number(selectedPkgId)) || hotspotPackages[0];
    if (!pkg) {
      alert("Silakan buat Paket Hotspot terlebih dahulu di Menu Manajemen Paket.");
      return;
    }

    const generated = [];
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    for (let i = 0; i < quantity; i++) {
      const code = prefix + generateRandomCode(codeLength);
      const password = format === 'same' ? code : generateRandomCode(6);
      
      generated.push({
        id: Date.now() + i,
        code: code,
        password: password,
        package: pkg.name,
        price: pkg.price,
        status: 'Unused',
        macBinding: macBinding,
        ipAddress: '-',
        activatedTime: '-',
        usedBytes: '0 MB',
        timeLeft: pkg.validity
      });
    }

    // Update global vouchers
    setVouchers([...generated, ...vouchers]);
    // Set local session generated list to display printing tickets
    setNewlyGenerated(generated);

    // Logging
    addSystemLog('SYSTEM', `Membuat ${quantity} Voucher baru untuk Paket "${pkg.name}"`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const header = 'Kode Voucher,Password,Paket,Harga,Status\n';
    const rows = newlyGenerated.map(v => 
      `${v.code},${v.password},${v.package},${v.price},${v.status}`
    ).join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voucher_batch_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Generator Voucher</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Cetak voucher eceran Hotspot secara massal dengan konfigurasi fleksibel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Left: Settings Form */}
        <div className="lg:col-span-4 bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.03)] h-fit">
          <h3 className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-surface-container pb-2">
            <span className="material-symbols-outlined text-[20px] text-primary">settings_suggest</span>
            Konfigurasi Voucher
          </h3>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Pilih Paket Hotspot</label>
              <select 
                value={selectedPkgId} 
                onChange={(e) => setSelectedPkgId(e.target.value)}
                className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                {hotspotPackages.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>
                ))}
                {hotspotPackages.length === 0 && (
                  <option value="">Belum ada paket hotspot</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Jumlah Voucher</label>
                <input 
                  type="number" 
                  min="1" 
                  max="500" 
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Panjang Kode</label>
                <input 
                  type="number" 
                  min="4" 
                  max="12" 
                  value={codeLength}
                  onChange={(e) => setCodeLength(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Prefix Kode (Awalan)</label>
              <input 
                type="text" 
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. HOT-"
                className="w-full px-3.5 py-2 border border-surface-dim rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Format Autentikasi</label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer text-body-md">
                  <input 
                    type="radio" 
                    name="format" 
                    value="same" 
                    checked={format === 'same'}
                    onChange={() => setFormat('same')}
                    className="text-primary focus:ring-primary/20"
                  />
                  Username = Password (Lebih Praktis)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-body-md">
                  <input 
                    type="radio" 
                    name="format" 
                    value="up" 
                    checked={format === 'up'}
                    onChange={() => setFormat('up')}
                    className="text-primary focus:ring-primary/20"
                  />
                  Username & Password Berbeda
                </label>
              </div>
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Pengaturan Keamanan</label>
              <label className="flex items-center gap-3 cursor-pointer mt-2 bg-surface-container-low border border-surface-dim rounded-lg p-3 transition-colors hover:bg-surface-container">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={macBinding}
                    onChange={(e) => setMacBinding(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-container-highest rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-lowest after:border-outline-variant after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-primary"></div>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface text-[13px]">Enable MAC Binding</span>
                  <span className="text-[11px] text-on-surface-variant leading-tight mt-0.5">Kunci voucher ke perangkat pertama</span>
                </div>
              </label>
            </div>

            <button 
              type="submit"
              className="w-full mt-4 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">generating_tokens</span>
              Generate Voucher
            </button>
          </form>
        </div>

        {/* Right: Output Tickets Panel */}
        <div className="lg:col-span-8 bg-surface-container-lowest border border-surface-variant/70 rounded-xl p-card-padding shadow-[0_1px_3px_rgba(77,68,227,0.03)] min-h-[350px] flex flex-col">
          <div className="flex justify-between items-center border-b border-surface-container pb-2 mb-4">
            <h3 className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-500">print</span>
              Hasil Cetakan Voucher ({newlyGenerated.length})
            </h3>
            {newlyGenerated.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportCSV}
                  className="border border-primary text-primary hover:bg-primary/10 font-label-md text-label-md px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export CSV
                </button>
                <button 
                  onClick={handlePrint}
                  className="bg-tertiary-container hover:opacity-90 text-on-tertiary font-label-md text-label-md px-3.5 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Cetak Tiket
                </button>
              </div>
            )}
          </div>

          {newlyGenerated.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-2">confirmation_number</span>
              <p className="font-headline-sm text-[16px] font-semibold">Belum Ada Voucher yang Digenerate</p>
              <p className="text-body-md text-label-sm max-w-sm mt-1">Gunakan panel sebelah kiri untuk mengatur parameter lalu klik "Generate" untuk mencetak kode voucher.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[450px] p-1">
              {newlyGenerated.map((item, idx) => (
                <div 
                  key={idx} 
                  className="border-2 border-dashed border-slate-300 bg-surface-container-low rounded-lg p-3 relative flex flex-col justify-between overflow-hidden shadow-sm"
                >
                  {/* Brand Header */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1 mb-2">
                    <span className="text-[10px] font-bold text-primary font-mono tracking-tighter">RT/RW NET</span>
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">HOTSPOT</span>
                  </div>

                  {/* Voucher Code Details */}
                  <div className="text-center my-2 space-y-1">
                    <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Kode Login / Kode Voucher</p>
                    <p className="text-[15px] font-black font-mono tracking-widest text-on-surface select-all bg-surface-container-lowest py-0.5 rounded border border-slate-200">{item.code}</p>
                    {format === 'up' && (
                      <p className="text-[10px] font-mono text-on-surface-variant">PASS: <span className="font-bold text-on-surface">{item.password}</span></p>
                    )}
                  </div>

                  {/* SSID Details & Expiry */}
                  <div className="text-[9px] font-mono text-on-surface-variant space-y-0.5 border-t border-slate-200 pt-1.5 mt-2">
                    <p>SSID: <span className="font-bold text-on-surface">RT_RW_NET_HOTSPOT</span></p>
                    <p>Paket: <span className="font-bold text-on-surface">{item.package}</span></p>
                  </div>

                  {/* Pricing Tag */}
                  <div className="absolute right-0 top-6 bg-amber-500 text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-l-md shadow-sm">
                    Rp {item.price.toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Printable Area - Render ONLY when printing */}
      <div className="hidden print:block w-full">
        <h2 className="text-center font-bold text-[18px] mb-4">Voucher Hotspot RT/RW NET</h2>
        <div className="grid grid-cols-3 gap-4">
          {newlyGenerated.map((item, idx) => (
            <div 
              key={idx} 
              className="border-2 border-dashed border-slate-400 bg-white p-3 flex flex-col justify-between h-[150px] relative"
            >
              <div className="flex justify-between items-center border-b border-slate-300 pb-1">
                <span className="text-[10px] font-bold">RT/RW NET</span>
                <span className="text-[9px] font-bold">HOTSPOT</span>
              </div>
              <div className="text-center my-2">
                <p className="text-[8px] text-slate-500 uppercase">KODE LOGIN</p>
                <p className="text-[15px] font-bold font-mono tracking-widest">{item.code}</p>
                {format === 'up' && (
                  <p className="text-[9px] font-mono">PASSWORD: {item.password}</p>
                )}
              </div>
              <div className="text-[8px] font-mono text-slate-600 border-t border-slate-200 pt-1">
                <p>SSID: RT_RW_NET_HOTSPOT</p>
                <p>Masa Aktif: {item.timeLeft}</p>
              </div>
              <div className="absolute right-0 top-6 bg-slate-800 text-white text-[9px] font-bold px-2 py-0.5 rounded-l">
                Rp {item.price.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
