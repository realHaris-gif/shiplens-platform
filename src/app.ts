import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth.routes';
import branchRoutes from './routes/branch.routes';
import memberRoutes from './routes/member.routes';
import collectionRoutes from './routes/collection.routes';

const app: Application = express();

app.use(express.json());
app.use(cookieParser());

app.use(healthRoutes);
app.use(authRoutes);
app.use(branchRoutes);
app.use(memberRoutes);
app.use(collectionRoutes);

export default app;