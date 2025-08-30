// API base (Railway)
const API_BASE = 'https://wapmarket-backend-production.up.railway.app/api';

const API = {
  async get(path, opts = {}) {
    const r = await fetch(API_BASE + path, opts);
    return r.json();
  },
  async post(path, data, opts = {}) {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async put(path, data, opts = {}) {
    const r = await fetch(API_BASE + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async upload(path, formData, opts = {}) {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      body: formData,
      ...(opts || {})
    });
    return r.json();
  }
};

window.API = API;
window.API_BASE = API_BASE;
