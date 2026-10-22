import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';
import { AuthService } from '../src/services/auth.service';
import { Role, ApplicationStatus } from '../src/types';
import { runMigrations } from '../src/db/migrate';

describe('Volunteer Intake & Member Conversion (Day 5)', () => {
  let hrToken: string;
  let hrId: string;
  let testBranchId: string;

  beforeAll(async () => {
    await runMigrations();

    // Ensure test branch exists
    const branchRes = await pool.query(`
      INSERT INTO branches (code, name, city, status)
      VALUES ('BR-TEST-HR', 'Karachi East', 'Karachi', 'ACTIVE')
      ON CONFLICT (code) DO UPDATE SET name = 'Karachi East', status = 'ACTIVE'
      RETURNING id
    `);
    testBranchId = branchRes.rows[0].id;

    // Ensure HR Lead user exists
    const hrEmail = 'hr-lead-test@shiplens.org';
    const userRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('${hrEmail}', 'hash', 'HR Officer', 'HR_LEAD')
      ON CONFLICT (email) DO UPDATE SET role = 'HR_LEAD'
      RETURNING id
    `);
    hrId = userRes.rows[0].id;

    hrToken = `Bearer ${AuthService.signToken({
      userId: hrId,
      email: hrEmail,
      role: Role.HR_LEAD,
    })}`;
  });

  it('should allow public submission of a volunteer application', async () => {
    const res = await request(app)
      .post('/applications')
      .send({
        fullName: 'Hamza Khan',
        email: `hamza.${Date.now()}@example.com`,
        phone: '+923001234567',
        preferredBranchId: testBranchId,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(ApplicationStatus.APPLIED);
    expect(res.body.full_name).toBe('Hamza Khan');
  });

  it('should convert accepted application into a member with unique MEM- code', async () => {
    // 1. Submit public application
    const appRes = await request(app)
      .post('/applications')
      .send({
        fullName: 'Zainab Bibi',
        email: `zainab.${Date.now()}@example.com`,
        phone: '+923009876543',
        preferredBranchId: testBranchId,
      });

    expect(appRes.status).toBe(201);
    const applicationId = appRes.body.id;

    // 2. HR reviews and accepts
    const reviewRes = await request(app)
      .patch(`/applications/${applicationId}/review`)
      .set('Authorization', hrToken)
      .send({
        status: ApplicationStatus.ACCEPTED,
        assignedBranchId: testBranchId,
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.application.status).toBe(ApplicationStatus.ACCEPTED);
    expect(reviewRes.body.member).not.toBeNull();
    expect(reviewRes.body.member.member_code).toMatch(/^MEM-\d+$/);

    // 3. Confirm audit log entry exists
    const auditRes = await pool.query(
      'SELECT * FROM audit_logs WHERE record_id = $1',
      [reviewRes.body.member.id]
    );
    expect(auditRes.rows.length).toBeGreaterThan(0);
  });
});