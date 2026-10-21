import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth.routes';

const app: Application = express();

app.use(express.json());
app.use(cookieParser());

// Mount API routes
app.use(healthRoutes);
app.use(authRoutes);

export default app;