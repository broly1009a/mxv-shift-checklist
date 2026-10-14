import { API_BASE_URL } from '@/context/AuthContext';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export function getAuthHeaders(token?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  // Prepend API_BASE_URL if relative
  const base = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  if (!params) return base;

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      qs.append(key, String(val));
    }
  });

  const queryString = qs.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export async function requestJson<T>(
  endpoint: string,
  options: RequestOptions = {},
  token?: string | null,
): Promise<T> {
  const url = buildUrl(endpoint, options.params);
  const headers = {
    ...getAuthHeaders(token),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Yêu cầu thất bại (HTTP ${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody && typeof errBody === 'object') {
        errMsg = errBody.message || errBody.error || errMsg;
      }
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}
