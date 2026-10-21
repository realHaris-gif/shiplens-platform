import request from 'supertest';
import app from '../src/app';

describe('GET /health Endpoint', () => {
  it('should return 200 or 503 and report database status', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('database');
  });
});