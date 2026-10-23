import { pool } from '../config/db';
import { AuthService } from '../services/auth.service';
import { Role, BranchStatus } from '../types';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding initial branches and administrative users...');
    await client.query('BEGIN');

    // 1. Seed Core Branches
    const branches = [
      { code: 'BR-101', name: 'Lahore Central', city: 'Lahore', status: BranchStatus.ACTIVE },
      { code: 'BR-102', name: 'Karachi South', city: 'Karachi', status: BranchStatus.ACTIVE },
      { code: 'BR-103', name: 'Islamabad Capital', city: 'Islamabad', status: BranchStatus.ACTIVE },
      { code: 'BR-104', name: 'Faisalabad City', city: 'Faisalabad', status: BranchStatus.ACTIVE },
      { code: 'BR-105', name: 'Peshawar Cantt', city: 'Peshawar', status: BranchStatus.ACTIVE },
    ];

    for (const b of branches) {
      await client.query(
        `INSERT INTO branches (code, name, city, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET 
           name = EXCLUDED.name, 
           city = EXCLUDED.city, 
           status = EXCLUDED.status`,
        [b.code, b.name, b.city, b.status]
      );
    }

    // 2. Fetch Lahore Central branch ID for default lead assignment
    const lahoreRes = await client.query("SELECT id FROM branches WHERE code = 'BR-101'");
    const lahoreId = lahoreRes.rows[0].id;

    // 3. Seed Default Test Accounts (Password: Password123!)
    const defaultPasswordHash = await AuthService.hashPassword('Password123!');

    const seedUsers = [
      {
        email: 'admin@shiplens.org',
        name: 'Super Administrator',
        role: Role.SUPER_ADMIN,
        branchId: null,
      },
      {
        email: 'finance@shiplens.org',
        name: 'Head Office Finance Reviewer',
        role: Role.FINANCE_REVIEWER,
        branchId: null,
      },
      {
        email: 'hr@shiplens.org',
        name: 'Central HR Lead',
        role: Role.HR_LEAD,
        branchId: null,
      },
      {
        email: 'lead.lahore@shiplens.org',
        name: 'Lahore Branch Lead',
        role: Role.BRANCH_LEAD,
        branchId: lahoreId,
      },
    ];

    for (const u of seedUsers) {
      await client.query(
        `INSERT INTO users (email, password_hash, name, role, branch_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (email) DO UPDATE SET 
           role = EXCLUDED.role,
           branch_id = EXCLUDED.branch_id,
           password_hash = EXCLUDED.password_hash`,
        [u.email, defaultPasswordHash, u.name, u.role, u.branchId]
      );
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully. Default password is: Password123!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));