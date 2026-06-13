import React from 'react';

export default function IsolirPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-error/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-error/10 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-surface-container-lowest border border-surface-variant/50 max-w-md w-full p-8 rounded-3xl shadow-xl text-center relative z-10">
        <div className="w-24 h-24 bg-error-container text-error rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-surface">
          <span className="material-symbols-outlined text-[48px]">wifi_off</span>
        </div>
        
        <h1 className="text-3xl font-headline-lg text-on-surface mb-3 tracking-tight">Koneksi Terisolir</h1>
        
        <p className="text-body-lg text-on-surface-variant mb-8 leading-relaxed">
          Mohon maaf, layanan internet Anda sementara ditangguhkan karena sistem mencatat adanya 
          <strong className="text-error font-bold"> tunggakan tagihan</strong> bulanan yang belum diselesaikan.
        </p>

        <div className="bg-surface-container-low p-5 rounded-2xl mb-8 border border-surface-dim shadow-inner text-left">
          <div className="flex items-start gap-4">
            <div className="mt-1 bg-primary/10 p-2 rounded-lg text-primary">
              <span className="material-symbols-outlined text-[24px]">payments</span>
            </div>
            <div>
              <div className="text-label-md text-on-surface font-bold mb-1">Langkah Selanjutnya</div>
              <div className="text-body-sm text-on-surface-variant leading-relaxed">
                Silakan lakukan pembayaran tagihan internet Anda. Jika Anda sudah membayar, akses internet akan otomatis pulih dalam beberapa menit, atau silakan tekan tombol di bawah ini.
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="w-full py-4 px-4 bg-primary text-on-primary rounded-xl font-label-lg hover:bg-primary-container hover:text-on-primary-container hover:shadow-md transition-all active:scale-[0.98] mb-6 flex justify-center items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          Saya Sudah Membayar (Cek Ulang)
        </button>
        
        <a 
          href="https://wa.me/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container-high text-on-surface hover:bg-surface-variant hover:text-on-surface-variant rounded-full font-label-md transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">support_agent</span>
          Hubungi Customer Service
        </a>
      </div>

      <div className="mt-8 text-label-sm text-outline z-10 text-center">
        Powered by Billing Radius &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
