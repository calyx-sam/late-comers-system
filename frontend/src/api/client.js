/**
 * API client with CSRF header and auth error handling.
 * All state-changing requests include X-CSRF-Token header.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add CSRF token to state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase())) {
      headers['X-CSRF-Token'] = '1';
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin',
    });

    // Handle auth errors globally
    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    return response;
  }

  async get(path) {
    const res = await this.request(path);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  async post(path, body) {
    const res = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  async put(path, body) {
    const res = await this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  async delete(path) {
    const res = await this.request(path, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  /** Upload FormData (for CSV import) */
  async upload(path, formData) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-CSRF-Token': '1' },  // No Content-Type — browser sets multipart boundary
      body: formData,
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 207) throw new Error(data.error || `Upload failed: ${res.status}`);
    return data;
  }

  /** Download a blob (for file exports) */
  async download(path, filename) {
    const res = await this.request(path);
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

const api = new ApiClient();
export default api;
