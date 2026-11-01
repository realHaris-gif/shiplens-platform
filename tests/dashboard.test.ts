import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { AuthService } from '../src/services/auth.service';
import { Role } from '../src/types';
import { runMigrations } from '../src/db/migrate';

describe('Executive Head Office Dashboard (Acceptance Criterion #1 & P0-09)', () => {
  let superAdminToken: string;
  let financeToken: string;
  let branchLeadToken: string;
  let editorToken: string;
  let testBranchId: string;
  let adminUserId: string;

  beforeAll(async () => {
    await runMigrations();

    // 1. Setup branch
    const bRes = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-DASH-1', 'Islamabad Capital', 'Islamabad', 'ACTIVE')
      ON CONFLICT (code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id
    `);
    testBranchId = bRes.rows[0].id;

    // 2. Setup a real admin user in database to satisfy UUID foreign key constraints
    const uRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('admin-dash-real@shiplens.org', 'hash', 'Dashboard Admin', 'SUPER_ADMIN')
      ON CONFLICT (email) DO UPDATE SET role = 'SUPER_ADMIN'
      RETURNING id
    `);
    adminUserId = uRes.rows[0].id;

    // 3. Generate tokens for role matrix test
    superAdminToken = `Bearer ${AuthService.signToken({
      userId: adminUserId,
      email: 'admin-dash-real@shiplens.org',
      role: Role.SUPER_ADMIN,
    })}`;

    financeToken = `Bearer ${AuthService.signToken({
      userId: adminUserId,
      email: 'fin-dash@shiplens.org',
      role: Role.FINANCE_REVIEWER,
    })}`;

    branchLeadToken = `Bearer ${AuthService.signToken({
      userId: adminUserId,
      email: 'lead-dash@shiplens.org',
      role: Role.BRANCH_LEAD,
      branchId: testBranchId,
    })}`;

    editorToken = `Bearer ${AuthService.signToken({
      userId: adminUserId,
      email: 'editor-dash@shiplens.org',
      role: Role.CONTENT_EDITOR,
    })}`;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM collections WHERE branch_id = $1", [testBranchId]);
  });

  it('should reject unauthenticated and unauthorized roles from accessing GET /dashboard', async () => {
    const noTokenRes = await request(app).get('/dashboard');
    expect(noTokenRes.status).toBe(401);

    const leadRes = await request(app)
      .get('/dashboard')
      .set('Authorization', branchLeadToken);
    expect(leadRes.status).toBe(403);

    const editorRes = await request(app)
      .get('/dashboard')
      .set('Authorization', editorToken);
    expect(editorRes.status).toBe(403);
  });

  it('should grant SUPER_ADMIN and FINANCE_REVIEWER access to GET /dashboard', async () => {
    const adminRes = await request(app)
      .get('/dashboard')
      .set('Authorization', superAdminToken);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toHaveProperty('summary');
    expect(adminRes.body).toHaveProperty('branches');
    expect(adminRes.body).toHaveProperty('monthlyTrends');

    const finRes = await request(app)
      .get('/dashboard')
      .set('Authorization', financeToken);
    expect(finRes.status).toBe(200);
  });

  it('should verify correct metric shapes and unrouted collections aggregate', async () => {
    // Insert an unrouted collection using the valid UUID adminUserId
    await pool.query(`
      INSERT INTO collections (branch_id, collected_by, amount_paisa, collection_date, is_sent_to_main_account)
      VALUES ($1, $2, 180000, '2026-10-20', false)
    `, [testBranchId, adminUserId]);

    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', superAdminToken);

    expect(res.status).toBe(200);
    const summary = res.body.summary;

    expect(Number(summary.unroutedCollectionsCount)).toBeGreaterThan(0);
    expect(Number(summary.unroutedPaisa)).toBeGreaterThan(0);
    expect(summary.unroutedPkr).toBeDefined();

    expect(Array.isArray(res.body.branches)).toBe(true);
    const sampleBranch = res.body.branches.find((b: any) => b.id === testBranchId);
    if (sampleBranch) {
      expect(sampleBranch.code).toBe('BR-DASH-1');
      expect(sampleBranch.status).toBe('ACTIVE');
    }

    expect(Array.isArray(res.body.monthlyTrends)).toBe(true);
    if (res.body.monthlyTrends.length > 0) {
      expect(res.body.monthlyTrends[0].month).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});