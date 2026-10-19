import { getApiBase } from './apiConfig';

async function request(method, path, body) {
  const url = `${getApiBase()}${path}`;
  const options = {
    method,
    headers: {},
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
      try {
        data = JSON.parse(data);
      } catch (_) {
        /* keep raw text */
      }
    }
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: (data && (data.message || data.error)) || `HTTP ${res.status}`,
      };
    }
    if (data && typeof data === 'object' && 'success' in data) {
      return data;
    }
    return { success: true, data };
  } catch (err) {
    console.error(`[api] ${method} ${path}`, err);
    return { success: false, message: err.message };
  }
}

export function apiGet(path, query) {
  let url = path;
  if (query && Object.keys(query).length) {
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (params) url += (url.includes('?') ? '&' : '?') + params;
  }
  return request('GET', url);
}

export function apiPost(path, body) {
  return request('POST', path, body);
}

export function apiPut(path, body) {
  return request('PUT', path, body);
}

export function apiDelete(path, body) {
  return request('DELETE', path, body);
}
