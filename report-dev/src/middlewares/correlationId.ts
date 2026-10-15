import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

function firstHeader(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) {
    const v = val[0]?.trim();
    return v || undefined;
  }
  const v = val.trim();
  return v || undefined;
}

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  let id = firstHeader(req.headers['correlation_id']);
  
  if (!id) {
    id = randomUUID();
  }
  
  req.headers['correlation_id'] = id;
  res.setHeader('correlation_id', id);
  next();
}
