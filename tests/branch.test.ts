import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { AuthService } from '../src/services/auth.service';
import { Role, BranchStatus } from '../src/types';
import { runMigrations } from '../src/db/migrate';

describe('Branch Lifecycle & State Machine (Day 4)', () => {
  let adminToken: string;
  let leadToken: string;
  let adminId: string;

  beforeAll(async () => {
    await runMigrations();

    // Ensure dummy superadmin exists in db
    const adminEmail = 'admin-branch-test@shiplens.org';
    const userRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('${adminEmail}', 'hash', 'Super Admin', 'SUPER_ADMIN')
      ON CONFLICT (email) DO UPDATE SET role = 'SUPER_ADMIN'
      RETURNING id
    `);
    adminId = userRes.rows[0].id;

    adminToken = `Bearer ${AuthService.signToken({
      userId: adminId,
      email: adminEmail,
      role: Role.SUPER_ADMIN,
    })}`;

    leadToken = `Bearer ${AuthService.signToken({
      userId: 'random-lead',
      email: 'lead@shiplens.org',
      role: Role.BRANCH_LEAD,
    })}`;
  });

  it('should reject non-admin from creating a branch', async () => {
    const res = await request(app)
      .post('/branches')
      .set('Authorization', leadToken)
      .send({ name: 'Faisalabad West', city: 'Faisalabad' });

    expect(res.status).toBe(403);
  });

  it('should create branch in FORMING status with sequential code', async () => {
    const res = await request(app)
      .post('/branches')
      .set('Authorization', adminToken)
      .send({ name: 'Lahore Central', city: 'Lahore' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(BranchStatus.FORMING);
    expect(res.body.code).toMatch(/^BR-\d+$/);

    // Verify audit log entry
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'BRANCH_CREATED' AND record_id = $1",
      [res.body.id]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  it('should reject activating a branch without an assigned BRANCH_LEAD', async () => {
    const createRes = await request(app)
      .post('/branches')
      .set('Authorization', adminToken)
      .send({ name: 'Rawalpindi Cantt', city: 'Rawalpindi' });

    const branchId = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/branches/${branchId}/status`)
      .set('Authorization', adminToken)
      .send({ status: BranchStatus.ACTIVE });

    expect(updateRes.status).toBe(422);
    expect(updateRes.body.error).toContain('Cannot activate branch without an assigned active BRANCH_LEAD');
  });

  it('should prevent transitioning out of CLOSED state', async () => {
    const createRes = await request(app)
      .post('/branches')
      .set('Authorization', adminToken)
      .send({ name: 'Old Branch', city: 'Multan' });

    const branchId = createRes.body.id;

    // Transition to CLOSED
    const closeRes = await request(app)
      .patch(`/branches/${branchId}/status`)
      .set('Authorization', adminToken)
      .send({ status: BranchStatus.CLOSED });
    expect(closeRes.status).toBe(200);

    // Attempt to transition to PAUSED or ACTIVE
    const attemptRes = await request(app)
      .patch(`/branches/${branchId}/status`)
      .set('Authorization', adminToken)
      .send({ status: BranchStatus.PAUSED });

    expect(attemptRes.status).toBe(422);
    expect(attemptRes.body.error).toContain('A closed branch cannot be reopened');
  });
});