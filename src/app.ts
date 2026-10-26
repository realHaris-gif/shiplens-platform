import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { pool } from './config/db';
import { globalLimiter, loginLimiter, applicationLimiter } from './middleware/rateLimiter';

// Route handlers
import healthRoutes from './routes/health';
import authRoutes from './routes/auth.routes';
import branchRoutes from './routes/branch.routes';
import memberRoutes from './routes/member.routes';
import collectionRoutes from './routes/collection.routes';
import reportRoutes from './routes/report.routes';
import contentRoutes from './routes/content.routes';

const app: Application = express();
app.set('trust proxy', 1);

// Body & Cookie parsers
app.use(express.json());
app.use(cookieParser());


const publicPath = path.resolve(__dirname, 'public');

// 1. Static assets (CSS, JS, images)
app.use(express.static(publicPath, { index: 'index.html' }));
app.use('/api', globalLimiter);

// 2. Health Check Endpoint (Probes DB connectivity)
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

// 3. API Route Modules (Mounted BEFORE any catch-all)
app.use(healthRoutes);
app.use(authRoutes);
app.use(branchRoutes);
app.use(memberRoutes);
app.use(collectionRoutes);
app.use(reportRoutes);
app.use(contentRoutes);

// 4. Explicit Root Route
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 5. SPA Fallback: ONLY serve index.html for browser HTML navigations
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(publicPath, 'index.html'));
  }
  return next();
});

// 6. Unhandled API endpoint 404 fallback (strictly JSON)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
app.use('/auth/login', loginLimiter);
app.use('/applications', applicationLimiter);

export default app;