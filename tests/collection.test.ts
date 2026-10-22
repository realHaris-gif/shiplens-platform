import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { AuthService } from '../src/services/auth.service';
import { Role } from '../src/types';
import { runMigrations } from '../src/db/migrate';

describe('Offline Collections & Paisa Financial Ledger (Day 6)', () => {
  let financeToken: string;
  let branchLeadToken: string;
  let otherBranchLeadToken: string;
  let testBranchId: string;
  let otherBranchId: string;
  let leadId: string;
  let financeId: string;

  beforeAll(async () => {
    await runMigrations();

    // 1. Setup active test branches
    const b1 = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-TEST-FIN-1', 'Lahore South', 'Lahore', 'ACTIVE')
      ON CONFLICT (code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id
    `);
    testBranchId = b1.rows[0].id;

    const b2 = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-TEST-FIN-2', 'Lahore North', 'Lahore', 'ACTIVE')
      ON CONFLICT (code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id
    `);
    otherBranchId = b2.rows[0].id;

    // 2. Setup Branch Lead user in DB
    const leadRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role, branch_id)
      VALUES ('lead-fin@shiplens.org', 'hash', 'Lead User', 'BRANCH_LEAD', '${testBranchId}')
      ON CONFLICT (email) DO UPDATE SET branch_id = '${testBranchId}'
      RETURNING id
    `);
    leadId = leadRes.rows[0].id;

    branchLeadToken = `Bearer ${AuthService.signToken({
      userId: leadId,
      email: 'lead-fin@shiplens.org',
      role: Role.BRANCH_LEAD,
      branchId: testBranchId,
    })}`;

    // 3. Setup Finance Reviewer user in DB to satisfy foreign key constraint on audit_logs
    const finRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('finance-reviewer@shiplens.org', 'hash', 'Finance Officer', 'FINANCE_REVIEWER')
      ON CONFLICT (email) DO UPDATE SET role = 'FINANCE_REVIEWER'
      RETURNING id
    `);
    financeId = finRes.rows[0].id;

    financeToken = `Bearer ${AuthService.signToken({
      userId: financeId,
      email: 'finance-reviewer@shiplens.org',
      role: Role.FINANCE_REVIEWER,
    })}`;

    otherBranchLeadToken = `Bearer ${AuthService.signToken({
      userId: leadId,
      email: 'lead-fin@shiplens.org',
      role: Role.BRANCH_LEAD,
      branchId: otherBranchId,
    })}`;
  });

  it('should reject non-integer paisa amounts (eliminating floats)', async () => {
    const res = await request(app)
      .post('/collections')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: testBranchId,
        amountPaisa: 1250.75, // float rejected
        collectionDate: '2026-10-22',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Amount must be a positive integer representing paisa');
  });

  it('should prevent a branch lead from recording collections for another branch', async () => {
    const res = await request(app)
      .post('/collections')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: otherBranchId,
        amountPaisa: 50000,
        collectionDate: '2026-10-22',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Cannot record collections for another branch');
  });

  it('should record integer paisa collection and record in audit log', async () => {
    const res = await request(app)
      .post('/collections')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: testBranchId,
        amountPaisa: 250000, // PKR 2,500.00
        collectionDate: '2026-10-22',
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.amount_paisa)).toBe(250000);
    expect(res.body.is_locked).toBe(false);

    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE record_id = $1 AND action = 'COLLECTION_RECORDED'",
      [res.body.id]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  it('should allow FINANCE_REVIEWER to lock a collection', async () => {
    const createRes = await request(app)
      .post('/collections')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: testBranchId,
        amountPaisa: 100000,
        collectionDate: '2026-10-22',
      });

    const collectionId = createRes.body.id;

    const lockRes = await request(app)
      .patch(`/collections/${collectionId}/lock`)
      .set('Authorization', financeToken);

    expect(lockRes.status).toBe(200);
    expect(lockRes.body.is_locked).toBe(true);

    // Verify re-locking is rejected with 422
    const relockRes = await request(app)
      .patch(`/collections/${collectionId}/lock`)
      .set('Authorization', financeToken);
    expect(relockRes.status).toBe(422);
  });
});