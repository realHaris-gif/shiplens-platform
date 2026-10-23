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

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use(healthRoutes);
app.use(authRoutes);
app.use(branchRoutes);
app.use(memberRoutes);
app.use(collectionRoutes);
app.use(reportRoutes);

// Fallback to index.html for root navigation
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export default app;