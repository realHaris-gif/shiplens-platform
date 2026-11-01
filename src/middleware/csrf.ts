// src/middleware/csrf.ts
import { Request, Response, NextFunction } from 'express';

export const csrfGuard = (req: Request, res: Response, next: NextFunction) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  // If using Authorization Bearer token header, CSRF does not apply
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  // If a cookie authentication session is used, require custom header
  const tokenCookie = (req as any).cookies?.token;
  if (!tokenCookie) return next();

  if (req.get('X-Requested-With') === 'ShipLens') {
    return next();
  }

  return res.status(403).json({
    error: 'CSRF_REJECTED',
    message: 'Missing required request header X-Requested-With'
  });
};