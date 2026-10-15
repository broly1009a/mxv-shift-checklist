import { Request } from 'express';

const exactPublicRoutes = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/me/forgot-password' },
  { method: 'POST', path: '/auth/me/verify-reset-token' },
  { method: 'POST', path: '/auth/me/reset-password' },
  { method: 'POST', path: '/auth/public-token' },
];

export function isPublicRoute(req: Pick<Request, 'method' | 'path'>): boolean {
  if (!req.method || !req.path) return false;
  
  let normalizedPath = req.path.replace(/\/+$/, '');
  if (normalizedPath === '') {
    normalizedPath = '/';
  }
  
  if (normalizedPath.startsWith('/api/')) {
    normalizedPath = normalizedPath.substring(4);
  }
  
  const method = req.method.toUpperCase();

  for (const route of exactPublicRoutes) {
    if (route.method === method && route.path === normalizedPath) {
      return true;
    }
  }

  if (method === 'POST' && /^\/auth\/verifyPIN\/[^/]+$/.test(normalizedPath)) {
    return true;
  }

  return false;
}
