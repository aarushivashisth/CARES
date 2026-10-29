/**
 * API client configuration and fetch helper with centralized error handling
 * and automatic JWT Authorization header injection.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('cares_auth_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data;
    try { data=await response.json(); } catch {
      if (response.ok) {
        const invalid=new Error('The API returned an invalid response. Check service routing and try again.');
        invalid.code='INVALID_API_RESPONSE';throw invalid;
      }
      data={};
    }

    if (!response.ok) {
      const error = new Error(data.error || `HTTP error! Status: ${response.status}`);
      error.status = response.status;
      error.code = data.code || 'API_REQUEST_ERROR';
      error.details = data.details || null;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const connErr = new Error('Unable to connect to the CARES platform API. Please ensure the backend service is running and accessible.');
      connErr.code = 'BACKEND_UNAVAILABLE';
      throw connErr;
    }
    throw err;
  }
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};
