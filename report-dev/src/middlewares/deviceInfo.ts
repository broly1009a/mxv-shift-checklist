import { Request, Response, NextFunction } from 'express';

export interface DeviceInfo {
  ip: string;
  client: string;
  os: string;
  device: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    deviceInfo?: DeviceInfo;
  }
}

function firstHeader(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) {
    return val[0]?.trim() || undefined;
  }
  return val.trim() || undefined;
}

function cleanIp(ipRaw: string | undefined): string {
  if (!ipRaw) return 'Unknown';
  let ip = ipRaw;
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  ip = ip.replace(/^::ffff:/, '');
  return ip || 'Unknown';
}

function cleanQuoted(val: string | undefined): string | undefined {
  if (!val) return undefined;
  return val.replace(/^"|"$/g, '').trim() || undefined;
}

function detectOs(ua: string): string {
  const lowerUa = ua.toLowerCase();
  if (lowerUa.includes('windows')) return 'Windows';
  if (lowerUa.includes('android')) return 'Android';
  if (lowerUa.includes('iphone') || lowerUa.includes('ipad') || lowerUa.includes('ipod')) return 'iOS';
  if (lowerUa.includes('macos') || lowerUa.includes('macintosh') || lowerUa.includes('mac os')) return 'macOS';
  if (lowerUa.includes('linux')) return 'Linux';
  return 'Unknown';
}

function detectDevice(ua: string, secChUaMobile: string | undefined): string {
  if (secChUaMobile === '?1') return 'Mobile';
  if (!ua) return 'Unknown';
  
  const lowerUa = ua.toLowerCase();
  if (lowerUa.includes('ipad') || lowerUa.includes('tablet')) return 'Tablet';
  if (lowerUa.includes('mobile') || lowerUa.includes('iphone') || lowerUa.includes('ipod') || lowerUa.includes('android')) return 'Mobile';
  
  return 'Desktop';
}

export function deviceInfo(req: Request, res: Response, next: NextFunction): void {
  const ip = cleanIp(
    firstHeader(req.headers['ip']) ||
    firstHeader(req.headers['x-forwarded-for']) ||
    firstHeader(req.headers['x-real-ip']) ||
    firstHeader(req.headers['cf-connecting-ip']) ||
    req.ip ||
    req.socket?.remoteAddress
  );

  const userAgent = firstHeader(req.headers['user-agent']) || '';
  const clientHeader = cleanQuoted(firstHeader(req.headers['client']));
  const osHeader = cleanQuoted(firstHeader(req.headers['os'])) || cleanQuoted(firstHeader(req.headers['sec-ch-ua-platform']));
  const deviceHeader = cleanQuoted(firstHeader(req.headers['device']));
  const secChUaMobile = cleanQuoted(firstHeader(req.headers['sec-ch-ua-mobile']));

  req.deviceInfo = {
    ip,
    client: clientHeader || userAgent || 'Unknown',
    os: osHeader || detectOs(userAgent),
    device: deviceHeader || detectDevice(userAgent, secChUaMobile),
  };

  next();
}
