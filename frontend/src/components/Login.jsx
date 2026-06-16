import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      
      if (json.success) {
        localStorage.setItem('rtrwnet_token', json.data.token);
        onLogin(json.data.user);
      } else {
        setError(json.message || 'Login gagal. Periksa username dan password.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server. Pastikan backend berjalan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-surface-container w-full max-w-md rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-primary p-8 text-center">
          <span className="material-symbols-outlined text-on-primary text-[48px] mb-2">network_wifi</span>
          <h1 className="text-on-primary text-2xl font-bold tracking-tight">Billing RT/RW NET</h1>
          <p className="text-primary-container text-sm mt-1">Sistem Manajemen Mikrotik & RADIUS</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          {error && (
            <div className="mb-4 bg-error-container text-on-error-container p-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}
          
          <div className="mb-5">
            <label className="block text-on-surface-variant text-sm font-medium mb-1.5 ml-1">Username</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70">person</span>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-surface-container-highest text-on-surface border-none rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary outline-none transition-shadow"
                placeholder="Masukkan username"
                required
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-on-surface-variant text-sm font-medium mb-1.5 ml-1">Password</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70">lock</span>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface-container-highest text-on-surface border-none rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary outline-none transition-shadow"
                placeholder="Masukkan password"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-on-primary py-3 rounded-full font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              <>
                <span className="material-symbols-outlined">login</span>
                Masuk ke Dasbor
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
