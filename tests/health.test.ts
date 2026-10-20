import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';

describe('GET /health Endpoint', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('should return 200 and confirm database connectivity', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('timestamp');
  });
});