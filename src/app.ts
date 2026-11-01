import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { pool } from './config/db';
import { globalLimiter } from './middleware/rateLimiter';

// Route handlers
import authRoutes from './routes/auth.routes';
import branchRoutes from './routes/branch.routes';
import memberRoutes from './routes/member.routes';
import collectionRoutes from './routes/collection.routes';
import reportRoutes from './routes/report.routes';
import contentRoutes from './routes/content.routes';
import dashboardRoutes from './routes/dashboard.routes';
import userRoutes from './routes/user.routes';
import auditRoutes from './routes/audit.routes';
import { ContactController } from './controllers/contact.controller';
import { errorHandler } from './middleware/error';


const app: Application = express();
app.set('trust proxy', 1);

// SEC-1: Security headers
app.disable('x-powered-by');
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// SEC-7: Limit JSON payload size to 100kb
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const publicPath = path.resolve(__dirname, 'public');

// Static assets (CSS, JS, images)
app.use(express.static(publicPath, { index: 'index.html', maxAge: '1h' }));

// P0-01: Mount global rate limiter across all incoming non-static API requests
app.use(globalLimiter);

// Single canonical health check endpoint (DB connectivity check)
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT 1 AS ok');
    if (dbRes.rows[0]?.ok === 1) {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        uptime: process.uptime(),
      });
    }
    return res.status(503).json({ status: 'unhealthy', database: 'query_failed' });
  } catch (error: any) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// API Route Modules
app.use(authRoutes);
app.use(branchRoutes);
app.use(memberRoutes);
app.use(collectionRoutes);
app.use(reportRoutes);
app.use(contentRoutes);
app.use(dashboardRoutes);
app.use(userRoutes);
app.use(auditRoutes);
app.post('/contact', ContactController.submit);
app.use(errorHandler);

// Explicit Root Route
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// SEC-7: SPA Fallback — ONLY serve index.html when Accept explicitly prefers text/html
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html') && !req.path.startsWith('/api') && !req.path.includes('.')) {
    return res.sendFile(path.join(publicPath, 'index.html'));
  }
  return next();
});

// Unhandled API endpoint 404 fallback (strictly JSON)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Central Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.statusCode || 500;
  const message = (process.env.NODE_ENV === 'production' && status === 500)
    ? 'Internal server error'
    : err.message || 'An unexpected error occurred';

  if (status >= 500) {
    console.error('Server Exception:', err);
  }

  res.status(status).json({
    error: err.name || 'Error',
    message,
  });
});

export default app;