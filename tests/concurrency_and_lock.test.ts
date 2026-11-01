import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { AuthService } from '../src/services/auth.service';
import { CollectionService } from '../src/services/collection.service';
import { Role, WeeklyReportStatus } from '../src/types';
import { runMigrations } from '../src/db/migrate';

describe('Financial Audit Guarantees: 7-Day Lock, Concurrency & CSV Protection', () => {
  let adminToken: string;
  let financeToken: string;
  let branchLeadToken: string;
  let testBranchId: string;
  let leadId: string;
  let financeId: string;
  const uniqueId = Date.now().toString().slice(-6);

  beforeAll(async () => {
    await runMigrations();

    const bRes = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-LK-${uniqueId}', 'Peshawar North ${uniqueId}', 'Peshawar', 'ACTIVE')
      ON CONFLICT (code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id
    `);
    testBranchId = bRes.rows[0].id;

    const uLead = await pool.query(`
      INSERT INTO users (email, password_hash, name, role, branch_id)
      VALUES ('lead-lock-${uniqueId}@shiplens.org', 'hash', 'Lock Lead', 'BRANCH_LEAD', '${testBranchId}')
      ON CONFLICT (email) DO UPDATE SET branch_id = '${testBranchId}'
      RETURNING id
    `);
    leadId = uLead.rows[0].id;

    const uFin = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('fin-lock-${uniqueId}@shiplens.org', 'hash', 'Lock Fin', 'FINANCE_REVIEWER')
      ON CONFLICT (email) DO UPDATE SET role = 'FINANCE_REVIEWER'
      RETURNING id
    `);
    financeId = uFin.rows[0].id;

    branchLeadToken = `Bearer ${AuthService.signToken({
      userId: leadId,
      email: `lead-lock-${uniqueId}@shiplens.org`,
      role: Role.BRANCH_LEAD,
      branchId: testBranchId,
    })}`;

    financeToken = `Bearer ${AuthService.signToken({
      userId: financeId,
      email: `fin-lock-${uniqueId}@shiplens.org`,
      role: Role.FINANCE_REVIEWER,
    })}`;

    adminToken = `Bearer ${AuthService.signToken({
      userId: leadId,
      email: `admin-lock-${uniqueId}@shiplens.org`,
      role: Role.SUPER_ADMIN,
    })}`;
  });

  afterAll(async () => {
    if (testBranchId) {
      await pool.query('DELETE FROM collections WHERE branch_id = $1', [testBranchId]);
      await pool.query('DELETE FROM weekly_reports WHERE branch_id = $1', [testBranchId]);
    }
  });

  describe('COL-1: 7-Day Immutability Window with Controllable Clock', () => {
    it('should allow editing a collection on Day 6, but block and permanently lock on Day 8', async () => {
      const col = await CollectionService.recordCollection(
        {
          branchId: testBranchId,
          amountPaisa: 50000,
          collectionDate: '2026-10-12',
        },
        leadId,
        testBranchId
      );

      const createdTimeMs = new Date(col.created_at).getTime();

      // Day 6 (6 days after creation = allowed)
      const day6Clock = createdTimeMs + 6 * 24 * 60 * 60 * 1000;
      const updatedDay6 = await CollectionService.updateCollection(
        col.id,
        { amountPaisa: 60000 },
        leadId,
        testBranchId,
        undefined,
        day6Clock
      );
      expect(Number(updatedDay6.amount_paisa)).toBe(60000);

      // Day 8 (8 days after creation = permanently locked)
      const day8Clock = createdTimeMs + 8 * 24 * 60 * 60 * 1000;
      await expect(
        CollectionService.updateCollection(
          col.id,
          { amountPaisa: 70000 },
          leadId,
          testBranchId,
          undefined,
          day8Clock
        )
      ).rejects.toThrow(/older than 7 days and is permanently locked/);

      const checkRes = await pool.query('SELECT is_locked FROM collections WHERE id = $1', [col.id]);
      expect(checkRes.rows[0].is_locked).toBe(true);
    });
  });

  describe('Criterion #2: Concurrent Approval Race Condition Protection', () => {
    it('should ensure exactly one request succeeds when two reviewers approve the same report simultaneously', async () => {
      // Create and submit report with fresh week dates
      const draftRes = await request(app)
        .post('/reports')
        .set('Authorization', branchLeadToken)
        .send({
          branchId: testBranchId,
          weekStartDate: '2026-08-03',
          weekEndDate: '2026-08-09',
        });
      expect(draftRes.status).toBe(201);
      const reportId = draftRes.body.id;

      const subRes = await request(app)
        .patch(`/reports/${reportId}/submit`)
        .set('Authorization', branchLeadToken);
      expect(subRes.status).toBe(200);

      // Fire two concurrent approvals simultaneously
      const [res1, res2] = await Promise.all([
        request(app).patch(`/reports/${reportId}/approve`).set('Authorization', financeToken),
        request(app).patch(`/reports/${reportId}/approve`).set('Authorization', adminToken),
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Exactly one must succeed (200) and the other rejected (422)
      expect(statuses).toEqual([200, 422]);

      const finalRes = await pool.query('SELECT status FROM weekly_reports WHERE id = $1', [reportId]);
      expect(finalRes.rows[0].status).toBe(WeeklyReportStatus.APPROVED);
    });
  });

  describe('CSV Injection Neutralization', () => {
    it('should prefix dangerous leading spreadsheet formula characters with single quote in export', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', branchLeadToken)
        .send({
          branchId: testBranchId,
          weekStartDate: '2026-07-27',
          weekEndDate: '2026-08-02',
          submissionNotes: '=cmd|’ /C calc’!A0',
        });

      const csvRes = await request(app)
        .get('/reports/export/csv')
        .set('Authorization', financeToken);

      expect(csvRes.status).toBe(200);
      expect(csvRes.text).toContain("'=cmd|");
    });
  });
});