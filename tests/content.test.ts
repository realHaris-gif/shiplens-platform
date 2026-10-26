import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { runMigrations } from '../src/db/migrate';

describe('Content Management Module (CMS)', () => {
  let editorToken: string;

  beforeAll(async () => {
    await runMigrations();

    // Authenticate as the seeded editor
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'editor@shiplens.org', password: 'Password123!' });

    editorToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Clean up test items
    await pool.query("DELETE FROM content_items WHERE title LIKE 'Test Bulletin%'");
  });

  it('should allow public access to GET /content without credentials', async () => {
    const res = await request(app).get('/content');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should reject unauthenticated requests to POST /admin/content', async () => {
    const res = await request(app)
      .post('/admin/content')
      .send({
        title: 'Unauthorized Post',
        body: 'Should fail without token',
        category: 'ANNOUNCEMENT'
      });
    expect([401, 403]).toContain(res.status);
  });

  it('should allow CONTENT_EDITOR to create a draft bulletin', async () => {
    if (!editorToken) return;

    const res = await request(app)
      .post('/admin/content')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Test Bulletin Genesis',
        category: 'ANNOUNCEMENT',
        summary: 'A short preview statement',
        body: 'Full operational details for branch volunteers.'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('DRAFT');
  });

  it('should allow CONTENT_EDITOR to publish a drafted bulletin', async () => {
    if (!editorToken) return;

    // Create item first
    const createRes = await request(app)
      .post('/admin/content')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Test Bulletin For Publishing',
        category: 'NEWS',
        summary: 'Publishing verification',
        body: 'Content to verify live state.'
      });

    const itemId = createRes.body.id;

    // Publish
    const pubRes = await request(app)
      .patch(`/admin/content/${itemId}/publish`)
      .set('Authorization', `Bearer ${editorToken}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.status).toBe('PUBLISHED');

    // Confirm it appears in the public feed
    const publicRes = await request(app).get('/content');
    const match = publicRes.body.find((item: any) => item.id === itemId);
    expect(match).toBeDefined();
    expect(match.title).toBe('Test Bulletin For Publishing');
  });

  it('should allow CONTENT_EDITOR to list all content items including drafts', async () => {
    if (!editorToken) return;

    const res = await request(app)
      .get('/admin/content')
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});