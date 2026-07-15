import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function VoucherTemplateEditor({ isOpen, onClose, initialTemplate, defaultTemplate, onSave }) {
  const [templateHtml, setTemplateHtml] = useState(initialTemplate || '');
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'preview'
  
  useEffect(() => {
    if (isOpen) {
      setTemplateHtml(initialTemplate);
      setActiveTab('editor');
    }
  }, [isOpen, initialTemplate]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(templateHtml);
    onClose();
  };

  const dummyVoucher = {
    code: 'X9R2-K7',
    password: 'PASS',
    package: 'Hotspot Hemat 5Mbps',
    price: 'Rp 50.000',
    timeLeft: '30 Hari',
    duration: 'Unlimited'
  };

  // Replace tags with dummy data for preview
  const getPreviewHtml = () => {
    let html = templateHtml;
    html = html.replace(/\{\{kode\}\}/g, dummyVoucher.code);
    html = html.replace(/\{\{password\}\}/g, dummyVoucher.password);
    html = html.replace(/\{\{paket\}\}/g, dummyVoucher.package);
    html = html.replace(/\{\{harga\}\}/g, dummyVoucher.price);
    html = html.replace(/\{\{masa_aktif\}\}/g, dummyVoucher.timeLeft);
    html = html.replace(/\{\{durasi\}\}/g, dummyVoucher.duration);
    html = html.replace(/\{\{warna_utama\}\}/g, '#14478C'); // Default preview blue
    html = html.replace(/\{\{warna_sekunder\}\}/g, '#1E62C2');
    html = html.replace(/\{\{warna_muda\}\}/g, '#E6F0FA');
    return html;
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">html</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-[18px] font-bold text-slate-800">Template Editor</h2>
              <p className="text-[12px] text-slate-500">Desain kustom tiket voucher dengan HTML & Tailwind CSS</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-background">
          
          {/* Left Panel: Editor */}
          <div className="flex-1 flex flex-col border-r border-surface-variant">
            <div className="px-4 py-2 border-b border-surface-variant flex gap-4 bg-surface-container-low">
              <button 
                onClick={() => setActiveTab('editor')} 
                className={`font-label-md text-sm pb-1 border-b-2 transition-colors ${activeTab === 'editor' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Kode HTML
              </button>
              <button 
                onClick={() => setActiveTab('preview')} 
                className={`md:hidden font-label-md text-sm pb-1 border-b-2 transition-colors ${activeTab === 'preview' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Preview
              </button>
            </div>
            
            <div className={`flex-1 flex flex-col p-4 ${activeTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
              <div className="mb-3 space-y-1">
                <p className="text-[11px] font-semibold text-slate-600">Variabel Tersedia (Klik untuk salin):</p>
                <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                  {['{{kode}}', '{{password}}', '{{paket}}', '{{harga}}', '{{durasi}}', '{{masa_aktif}}', '{{warna_utama}}', '{{warna_sekunder}}', '{{warna_muda}}'].map(v => (
                    <span 
                      key={v} 
                      onClick={() => navigator.clipboard.writeText(v)} 
                      className="bg-primary-container text-on-primary-container px-2 py-1 rounded cursor-pointer hover:bg-primary hover:text-white transition-colors"
                      title="Salin ke clipboard"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <textarea
                value={templateHtml}
                onChange={(e) => setTemplateHtml(e.target.value)}
                className="flex-1 w-full p-4 font-mono text-[13px] bg-[#1E1E1E] text-[#D4D4D4] rounded-xl border border-zinc-800 focus:border-primary/50 outline-none resize-none transition-colors"
                spellCheck="false"
                placeholder="<!-- Masukkan kode HTML di sini -->"
              />
            </div>
          </div>

          {/* Right Panel: Live Preview */}
          <div className={`w-full md:w-1/2 flex flex-col bg-slate-50 ${activeTab === 'editor' ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-4 py-2 border-b border-surface-variant bg-surface-container-low flex items-center justify-between">
              <span className="font-label-md text-sm text-slate-700 font-bold">Live Preview</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">Menampilkan 1 Contoh Tiket</span>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
              <div 
                className="text-black font-sans shadow-xl transform transition-all overflow-hidden rounded-2xl border-2 border-dashed border-slate-500"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-variant bg-surface-container-low flex justify-between items-center">
          <button 
            onClick={() => setTemplateHtml(defaultTemplate)} 
            className="text-sm font-label-md text-slate-500 hover:text-slate-800 transition-colors"
          >
            Reset ke Default
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2 rounded-lg font-label-md text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleSave}
              className="px-5 py-2 rounded-lg font-label-md text-sm font-semibold bg-primary text-white hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Simpan Template
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
