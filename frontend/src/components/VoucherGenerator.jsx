import React, { useState } from 'react';
import VoucherTemplateEditor from './VoucherTemplateEditor';

export default function VoucherGenerator({ packages, vouchers, setVouchers, fetchVouchers, voucherTemplate, setVoucherTemplate, defaultTemplate, addSystemLog }) {
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
  const [editorOpen, setEditorOpen] = useState(false);

  const handleGenerate = (e) => {
    e.preventDefault();
    const pkg = packages.find(p => p.id === Number(selectedPkgId)) || hotspotPackages[0];
    if (!pkg) {
      alert("Silakan buat Paket Hotspot terlebih dahulu di Menu Manajemen Paket.");
      return;
    }

    const payload = {
      package_id: Number(selectedPkgId || pkg.id),
      quantity: Number(quantity),
      prefix,
      code_length: Number(codeLength),
      format,
      mac_binding: macBinding
    };

    fetch('/api/vouchers/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const mapped = json.data.map(v => ({
            id: v.id,
            code: v.code,
            password: v.password,
            package: v.package_name,
            price: v.price,
            status: v.status,
            ipAddress: v.ip_address || '-',
            macAddress: v.mac_address || '',
            activatedTime: v.activated_at ? new Date(v.activated_at).toLocaleString('id-ID') : '-',
            usedBytes: '0 MB',
            timeLeft: v.expires_at ? '' : (pkg.validity || '-'),
            expiresAt: v.expires_at ? new Date(v.expires_at).getTime() : undefined,
            duration: pkg.duration || '-',
            validity: pkg.validity || '-',
          }));
          setNewlyGenerated(mapped);
          fetchVouchers();
          addSystemLog('SYSTEM', `Membuat ${quantity} Voucher baru untuk Paket "${pkg.name}"`);
        } else {
          alert(json.message || 'Gagal men-generate voucher.');
        }
      })
      .catch(err => {
        alert('Error: ' + err.message);
      });
  };

  const handlePrint = () => {
    const printArea = document.getElementById('printable-voucher-items');
    if (!printArea) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Silakan izinkan Popup pada browser Anda untuk mencetak tiket di halaman baru.");
      return;
    }

    let styles = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      styles += node.outerHTML;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <title>Cetak Tiket Voucher</title>
          ${styles}
          <style>
            body { background: white; padding: 20px; }
            @media print {
              @page { margin: 5mm; }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2 class="text-center font-black text-[24px] mb-6 tracking-wider uppercase border-b-2 border-black pb-2 mx-auto max-w-sm font-sans">
            Voucher Internet
          </h2>
          <div class="flex flex-wrap gap-4 justify-center items-start content-start">
            ${printArea.innerHTML}
          </div>
          <script>
            setTimeout(() => {
              window.print();
            }, 800);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Generator Voucher</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Cetak voucher eceran Hotspot secara massal dengan konfigurasi fleksibel.</p>
        </div>
        <button 
          onClick={() => setEditorOpen(true)}
          className="bg-white border border-surface-variant text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-label-md text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors active:scale-95 print:hidden"
        >
          <span className="material-symbols-outlined text-[18px]">brush</span>
          Edit Template
        </button>
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
                className="w-full px-3.5 py-2 border border-surface-dim bg-surface-container-lowest text-on-surface rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                  className="w-full px-3.5 py-2 border border-surface-dim bg-surface-container-lowest text-on-surface rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                  className="w-full px-3.5 py-2 border border-surface-dim bg-surface-container-lowest text-on-surface rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                className="w-full px-3.5 py-2 border border-surface-dim bg-surface-container-lowest text-on-surface rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
      <div className="hidden print:block w-full text-black font-sans" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <h2 className="text-center font-black text-[24px] mb-6 tracking-wider uppercase border-b-2 border-black pb-2 mx-auto max-w-sm">
          Voucher Internet
        </h2>
        <div id="printable-voucher-items" className="flex flex-wrap gap-4 justify-center">
          {newlyGenerated.map((item, idx) => {
            // Determine colors dynamically based on package or price
            const palettes = [
              { main: '#14478C', sub: '#1E62C2', light: '#E6F0FA' }, // Blue
              { main: '#C62828', sub: '#E53935', light: '#FFEBEE' }, // Red
              { main: '#2E7D32', sub: '#43A047', light: '#E8F5E9' }, // Green
              { main: '#F57F17', sub: '#FBC02D', light: '#FFFDE7' }, // Yellow/Orange
              { main: '#4527A0', sub: '#5E35B1', light: '#EDE7F6' }, // Purple
              { main: '#00695C', sub: '#00897B', light: '#E0F2F1' }, // Teal
              { main: '#AD1457', sub: '#D81B60', light: '#FCE4EC' }, // Pink
            ];
            // Hash the package name or use price to pick a consistent color
            let hash = 0;
            for (let i = 0; i < item.package.length; i++) {
              hash = item.package.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colorIndex = Math.abs(hash) % palettes.length;
            const palette = palettes[colorIndex];

            let html = voucherTemplate || '';
            html = html.replace(/\{\{kode\}\}/g, item.code);
            html = html.replace(/\{\{password\}\}/g, item.password);
            html = html.replace(/\{\{paket\}\}/g, item.package);
            html = html.replace(/\{\{harga\}\}/g, 'Rp ' + item.price.toLocaleString('id-ID'));
            const masaAktif = item.validity || item.timeLeft || '-';
            html = html.replace(/\{\{masa_aktif\}\}/g, masaAktif);
            html = html.replace(/\{\{durasi\}\}/g, item.duration || '-');
            
            // Apply dynamic colors
            html = html.replace(/\{\{warna_utama\}\}/g, palette.main);
            html = html.replace(/\{\{warna_sekunder\}\}/g, palette.sub);
            html = html.replace(/\{\{warna_muda\}\}/g, palette.light);
            
            return (
              <div 
                key={idx} 
                dangerouslySetInnerHTML={{ __html: html }} 
                style={{ pageBreakInside: 'avoid' }}
              />
            );
          })}
        </div>
      </div>

      <VoucherTemplateEditor 
        isOpen={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        initialTemplate={voucherTemplate} 
        defaultTemplate={defaultTemplate}
        onSave={(newTemplate) => {
          setVoucherTemplate(newTemplate);
          addSystemLog('SYSTEM', 'Template cetak voucher berhasil diperbarui.');
        }} 
      />
    </div>
  );
}
