import express, { Application } from 'express';
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

// Define public folder path
const publicPath = path.resolve(__dirname, 'public');

// Serve static assets with index.html enabled
app.use(express.static(publicPath, { index: 'index.html' }));

// Explicit GET / handler
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// API routes
app.use(healthRoutes);
app.use(authRoutes);
app.use(branchRoutes);
app.use(memberRoutes);
app.use(collectionRoutes);
app.use(reportRoutes);

// Catch-all SPA fallback for non-API GET routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  return res.sendFile(path.join(publicPath, 'index.html'));
});

export default app;