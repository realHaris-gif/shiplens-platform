import express, { Application } from 'express';
import healthRoutes from './routes/health';

const app: Application = express();

app.use(express.json());
app.use(healthRoutes);

export default app;