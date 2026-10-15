import { API_BASE_URL } from '@/context/AuthContext';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
}

export function getAuthHeaders(token?: string | null): HeadersInit {
  const resolvedToken =
    token ||
    (typeof window !== 'undefined' ? localStorage.getItem('mxv_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };
}

export function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  // Prepend API_BASE_URL if relative
  const base = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
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
  const actualToken = token ?? options.token;
  const url = buildUrl(endpoint, options.params);
  const headers = {
    ...getAuthHeaders(actualToken),
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

/**
 * Gửi request chứa FormData (Multipart/form-data) cho các endpoint upload tệp tin
 */
export async function requestFormData<T>(
  endpoint: string,
  formData: FormData,
  optionsOrToken: Omit<RequestOptions, 'body'> | string | null = {},
  token?: string | null,
): Promise<T> {
  const options: Omit<RequestOptions, 'body'> =
    typeof optionsOrToken === 'object' && optionsOrToken !== null ? optionsOrToken : {};
  const actualToken = typeof optionsOrToken === 'string' ? optionsOrToken : token;

  const url = buildUrl(endpoint, options.params);
  const headers: HeadersInit = {
    ...(actualToken ? { Authorization: `Bearer ${actualToken}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    method: options.method || 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errMsg = `Upload thất bại (HTTP ${res.status})`;
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

/**
 * Tải file Blob (Zip, Excel, CSV) trực tiếp từ API và kích hoạt lưu trên trình duyệt
 */
export async function downloadBlob(
  endpoint: string,
  defaultFilename = 'downloaded_file',
  options: RequestOptions = {},
  token?: string | null,
): Promise<void> {
  const actualToken = token ?? options.token;
  const url = buildUrl(endpoint, options.params);
  const headers: HeadersInit = {
    ...(actualToken ? { Authorization: `Bearer ${actualToken}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`Tải tệp tin thất bại (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;

  // Lấy filename từ header Content-Disposition nếu có
  let filename = defaultFilename;
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  a.remove();
}
