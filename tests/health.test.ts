import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';

describe('GET /health Endpoint', () => {
  afterAll(async () => {

    await pool.end();
  });

  it('should return 200 or 503 and report database status', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('database');
  });
});