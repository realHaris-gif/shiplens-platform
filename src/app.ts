import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth.routes';
import branchRoutes from './routes/branch.routes';
import memberRoutes from './routes/member.routes';
import collectionRoutes from './routes/collection.routes';
import reportRoutes from './routes/report.routes';

const app: Application = express();

app.use(express.json());
app.use(cookieParser());

const publicPath = path.resolve(__dirname, 'public');

// 1. Static assets (CSS, JS, images)
app.use(express.static(publicPath, { index: 'index.html' }));

// 2. Explicit Root Route
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 3. API & Health Endpoints
app.use(healthRoutes);
app.use(authRoutes);
app.use(branchRoutes);
app.use(memberRoutes);
app.use(collectionRoutes);
app.use(reportRoutes);

// 4. SPA Fallback: ONLY serve index.html for direct browser page navigations (HTML accepts)
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(publicPath, 'index.html'));
  }
  return next();
});

// 5. Unhandled API endpoint 404 fallback (strictly JSON)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;