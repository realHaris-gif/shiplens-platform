import { Router, Request, Response } from 'express';
import { pool } from '../config/db';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT 1 AS status');
    if (dbRes.rows && dbRes.rows.length > 0) {
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    }
    return res.status(503).json({
      status: 'error',
      database: 'unresponsive',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;