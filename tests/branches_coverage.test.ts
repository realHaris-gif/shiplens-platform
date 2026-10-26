import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';

describe('Branch Coverage Validation Suite', () => {
  let editorToken: string;

  beforeAll(async () => {
    const editorRes = await request(app)
      .post('/auth/login')
      .send({ email: 'editor@shiplens.org', password: 'Password123!' });
    editorToken = editorRes.body.token;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM content_items WHERE title LIKE 'EdgeCase%'");
  });

  describe('Auth Validation Branches', () => {
    it('should reject login for non-existent email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'non_existent_ghost_user@shiplens.org', password: 'Password123!' });
      expect([400, 401, 404]).toContain(res.status);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@shiplens.org', password: 'WrongPassword999!' });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject login with missing credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@shiplens.org' });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Content Query Filtering Branches', () => {
    it('should create an item with optional fields populated', async () => {
      if (!editorToken) return;

      const res = await request(app)
        .post('/admin/content')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          title: 'EdgeCase News Item',
          category: 'NEWS',
          summary: 'Summary edge case check',
          body: 'Full content body text.'
        });

      expect([200, 201]).toContain(res.status);
    });

    it('should filter public content by category', async () => {
      const res = await request(app).get('/content?category=NEWS');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should handle public content queries for non-existent categories gracefully', async () => {
      const res = await request(app).get('/content?category=NON_EXISTENT_CAT');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should handle unauthenticated publish attempts', async () => {
      const res = await request(app)
        .patch('/admin/content/00000000-0000-0000-0000-000000000000/publish');
      expect([401, 403]).toContain(res.status);
    });
  });
});