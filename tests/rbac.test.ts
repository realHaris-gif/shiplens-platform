import request from 'supertest';
import app from '../src/app';
import { AuthService } from '../src/services/auth.service';
import { Role } from '../src/types';

describe('RBAC Middleware Server-Side Enforcement (Acceptance Criterion #3)', () => {
  const generateAuthHeader = (role: Role) => {
    const token = AuthService.signToken({
      userId: 'test-user-id',
      email: `${role.toLowerCase()}@shiplens.org`,
      role,
    });
    return `Bearer ${token}`;
  };

  it('should return 401 Unauthorized when no token is provided', async () => {
    const res = await request(app).get('/admin/system-settings');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should reject non-SuperAdmin roles attempting to access /admin/system-settings with 403 Forbidden', async () => {
    const unauthorizedRoles = [
      Role.FINANCE_REVIEWER,
      Role.CONTENT_EDITOR,
      Role.BRANCH_LEAD,
      Role.HR_LEAD,
    ];

    for (const role of unauthorizedRoles) {
      const res = await request(app)
        .get('/admin/system-settings')
        .set('Authorization', generateAuthHeader(role));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    }
  });

  it('should grant SuperAdmin access to /admin/system-settings with 200 OK', async () => {
    const res = await request(app)
      .get('/admin/system-settings')
      .set('Authorization', generateAuthHeader(Role.SUPER_ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.access).toBe('granted');
  });

  it('should allow only HR_LEAD and SUPER_ADMIN to access /hr/applications', async () => {
    const hrRes = await request(app)
      .get('/hr/applications')
      .set('Authorization', generateAuthHeader(Role.HR_LEAD));
    expect(hrRes.status).toBe(200);

    const branchRes = await request(app)
      .get('/hr/applications')
      .set('Authorization', generateAuthHeader(Role.BRANCH_LEAD));
    expect(branchRes.status).toBe(403);
  });

  it('should allow only BRANCH_LEAD to access /branch/submit-report and refuse Finance Reviewer', async () => {
    const branchRes = await request(app)
      .get('/branch/submit-report')
      .set('Authorization', generateAuthHeader(Role.BRANCH_LEAD));
    expect(branchRes.status).toBe(200);

    const finRes = await request(app)
      .get('/branch/submit-report')
      .set('Authorization', generateAuthHeader(Role.FINANCE_REVIEWER));
    expect(finRes.status).toBe(403);
  });
});