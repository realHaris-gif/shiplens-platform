import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth.routes';
import branchRoutes from './routes/branch.routes';

const app: Application = express();

app.use(express.json());
app.use(cookieParser());

app.use(healthRoutes);
app.use(authRoutes);
app.use(branchRoutes);

export default app;