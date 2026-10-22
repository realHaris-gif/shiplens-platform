import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { AuthService } from '../src/services/auth.service';
import { Role, WeeklyReportStatus } from '../src/types';
import { runMigrations } from '../src/db/migrate';

describe('Weekly Reports & Frozen Metrics Architecture (Day 7)', () => {
  let branchLeadToken: string;
  let financeToken: string;
  let testBranchId: string;
  let otherBranchId: string;
  let leadId: string;
  let financeId: string;
  const uniquePrefix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    await runMigrations();

    // 1. Setup active branches
    const bRes1 = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-REP-${uniquePrefix}-1', 'Islamabad Capital', 'Islamabad', 'ACTIVE')
      RETURNING id
    `);
    testBranchId = bRes1.rows[0].id;

    const bRes2 = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-REP-${uniquePrefix}-2', 'Rawalpindi Hub', 'Rawalpindi', 'ACTIVE')
      RETURNING id
    `);
    otherBranchId = bRes2.rows[0].id;

    // 2. Setup Branch Lead in DB
    const leadEmail = `lead-rep-${uniquePrefix}@shiplens.org`;
    const leadRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role, branch_id)
      VALUES ('${leadEmail}', 'hash', 'Rep Lead', 'BRANCH_LEAD', '${testBranchId}')
      RETURNING id
    `);
    leadId = leadRes.rows[0].id;

    branchLeadToken = `Bearer ${AuthService.signToken({
      userId: leadId,
      email: leadEmail,
      role: Role.BRANCH_LEAD,
      branchId: testBranchId,
    })}`;

    // 3. Setup Finance Reviewer in DB
    const finEmail = `fin-rep-${uniquePrefix}@shiplens.org`;
    const finRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('${finEmail}', 'hash', 'Fin Reviewer', 'FINANCE_REVIEWER')
      RETURNING id
    `);
    financeId = finRes.rows[0].id;

    financeToken = `Bearer ${AuthService.signToken({
      userId: financeId,
      email: finEmail,
      role: Role.FINANCE_REVIEWER,
    })}`;

    // 4. Seed collections
    await pool.query(`
      INSERT INTO collections (branch_id, collected_by, amount_paisa, collection_date)
      VALUES 
        ('${testBranchId}', '${leadId}', 150000, '2026-10-12'),
        ('${testBranchId}', '${leadId}', 250000, '2026-10-14')
    `);
  });

  it('should reject draft creation with missing fields or cross-branch access', async () => {
    // Missing branchId
    const res1 = await request(app)
      .post('/reports')
      .set('Authorization', branchLeadToken)
      .send({ weekStartDate: '2026-10-12', weekEndDate: '2026-10-18' });
    expect(res1.status).toBe(400);

    // Cross-branch violation
    const res2 = await request(app)
      .post('/reports')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: otherBranchId,
        weekStartDate: '2026-10-12',
        weekEndDate: '2026-10-18',
      });
    expect(res2.status).toBe(403);
  });

  it('should draft a weekly report with accurate aggregated collections', async () => {
    const res = await request(app)
      .post('/reports')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: testBranchId,
        weekStartDate: '2026-10-12',
        weekEndDate: '2026-10-18',
        submissionNotes: 'Regular collections week',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(WeeklyReportStatus.DRAFT);
    expect(Number(res.body.total_amount_paisa)).toBe(400000);
  });

  it('should exercise return and resubmit workflow', async () => {
    // 1. Create draft
    const draftRes = await request(app)
      .post('/reports')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: testBranchId,
        weekStartDate: '2026-10-05',
        weekEndDate: '2026-10-11',
      });
    expect(draftRes.status).toBe(201);
    const reportId = draftRes.body.id;

    // 2. Submit
    const subRes = await request(app)
      .patch(`/reports/${reportId}/submit`)
      .set('Authorization', branchLeadToken);
    expect(subRes.status).toBe(200);
    expect(subRes.body.status).toBe(WeeklyReportStatus.SUBMITTED);

    // 3. Return report with reason
    const retRes = await request(app)
      .patch(`/reports/${reportId}/return`)
      .set('Authorization', financeToken)
      .send({ rejectionReason: 'Receipts do not match physical cash count' });
    expect(retRes.status).toBe(200);
    expect(retRes.body.status).toBe(WeeklyReportStatus.RETURNED);
    expect(retRes.body.rejection_reason).toContain('Receipts do not match');

    // 4. Resubmit report
    const resubRes = await request(app)
      .patch(`/reports/${reportId}/submit`)
      .set('Authorization', branchLeadToken);
    expect(resubRes.status).toBe(200);
    expect(resubRes.body.status).toBe(WeeklyReportStatus.RESUBMITTED);
  });

  it('should progress through submit, approve, freeze metrics, and list reports', async () => {
    // 1. Create a fresh draft
    const draftRes = await request(app)
      .post('/reports')
      .set('Authorization', branchLeadToken)
      .send({
        branchId: testBranchId,
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
      });
    expect(draftRes.status).toBe(201);
    const reportId = draftRes.body.id;

    // 2. Submit report
    const submitRes = await request(app)
      .patch(`/reports/${reportId}/submit`)
      .set('Authorization', branchLeadToken);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe(WeeklyReportStatus.SUBMITTED);

    // 3. Finance approves report
    const approveRes = await request(app)
      .patch(`/reports/${reportId}/approve`)
      .set('Authorization', financeToken);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe(WeeklyReportStatus.APPROVED);
    expect(approveRes.body.frozen_metrics).toBeDefined();
    expect(approveRes.body.frozen_metrics.approvedBy).toBe(financeId);

    // 4. List reports filter check
    const listRes = await request(app)
      .get('/reports')
      .set('Authorization', financeToken)
      .query({ branchId: testBranchId, status: WeeklyReportStatus.APPROVED });
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThan(0);
  });
});