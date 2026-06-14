// ─── API Client — Axios wrapper for RT/RW NET Billing Backend ─────────────────
// All API calls go through this module.
// Handles base URL, error parsing, and common headers.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001/api`;

/**
 * Core fetch wrapper with JSON parsing and error handling.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({ success: false, error: 'Invalid JSON response' }));

  if (!response.ok) {
    const err = new Error(data.message || data.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.data   = data;
    throw err;
  }

  return data;
}

// Shorthand helpers
const get    = (path, params)   => apiFetch(path + (params ? '?' + new URLSearchParams(params) : ''), { method: 'GET' });
const post   = (path, body)     => apiFetch(path, { method: 'POST',   body });
const put    = (path, body)     => apiFetch(path, { method: 'PUT',    body });
const del    = (path, body)     => apiFetch(path, { method: 'DELETE', body });
const patch  = (path, body)     => apiFetch(path, { method: 'PATCH',  body });

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => get('/health'),
};

// ─── Packages ─────────────────────────────────────────────────────────────────
export const packagesApi = {
  list:   (params)   => get('/packages', params),
  get:    (id)       => get(`/packages/${id}`),
  create: (data)     => post('/packages', data),
  update: (id, data) => put(`/packages/${id}`, data),
  delete: (id)       => del(`/packages/${id}`),
};

// ─── Vouchers (Active) ────────────────────────────────────────────────────────
export const vouchersApi = {
  list:       (params)   => get('/vouchers', params),
  stats:      ()         => get('/vouchers/stats'),
  get:        (id)       => get(`/vouchers/${id}`),
  generate:   (data)     => post('/vouchers/generate', data),
  update:     (id, data) => put(`/vouchers/${id}`, data),
  delete:     (id)       => del(`/vouchers/${id}`),
  bulkDelete: (ids)      => del('/vouchers/bulk', { ids }),
  disconnect: (id)       => post(`/vouchers/${id}/disconnect`),
  expireNow:  ()         => post('/vouchers/expire-now'),
};

// ─── Voucher Logs (Expired/Hangus) ────────────────────────────────────────────
export const voucherLogsApi = {
  list:     (params)   => get('/voucher-logs', params),
  get:      (id)       => get(`/voucher-logs/${id}`),
  stats:    ()         => get('/voucher-logs/summary/stats'),
  delete:   (id)       => del(`/voucher-logs/${id}`),
  bulkDel:  (ids)      => del('/voucher-logs/bulk/delete', { ids }),
  clearAll: ()         => del('/voucher-logs/clear/all'),
};

// ─── Members ──────────────────────────────────────────────────────────────────
export const membersApi = {
  list:     (params)   => get('/members', params),
  get:      (id)       => get(`/members/${id}`),
  sessions: (id)       => get(`/members/${id}/sessions`),
  create:   (data)     => post('/members', data),
  update:   (id, data) => put(`/members/${id}`, data),
  extend:   (id, days) => post(`/members/${id}/extend`, { days }),
  delete:   (id)       => del(`/members/${id}`),
};

// ─── Routers (PPPoE) ──────────────────────────────────────────────────────────
export const routersApi = {
  list:      (params)         => get('/routers', params),
  get:       (id)             => get(`/routers/${id}`),
  create:    (data)           => post('/routers', data),
  update:    (id, data)       => put(`/routers/${id}`, data),
  delete:    (id)             => del(`/routers/${id}`),
  isolir:    (id, reason)     => post(`/routers/${id}/isolir`,   { reason }),
  unisolir:  (id)             => post(`/routers/${id}/unisolir`),
};

// ─── FreeRADIUS ───────────────────────────────────────────────────────────────
export const radiusApi = {
  status:   () => get('/radius/status'),
  sessions: () => get('/radius/sessions'),
  logs:     (limit = 50) => get('/radius/logs', { limit }),
  sync:     () => post('/radius/sync'),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats:          () => get('/dashboard/stats'),
  recentActivity: () => get('/dashboard/recent-activity'),
  addLog:         (data) => post('/dashboard/log', data),
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get:          () => get('/settings'),
  save:         (data) => put('/settings', data),
  testRadius:   () => post('/settings/test-radius'),
  testMikrotik: (host, port) => post('/settings/test-mikrotik', { host, port }),
};

// ─── Utility: format bytes ────────────────────────────────────────────────────
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default apiFetch;
