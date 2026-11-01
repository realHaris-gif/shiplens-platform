import { pool } from '../config/db';
import { AuthService } from '../services/auth.service';
import { Role, BranchStatus, WeeklyReportStatus, ContentStatus } from '../types';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding branches, 5 administrative roles, sequences, and sample data...');
    await client.query('BEGIN');

    // 1. Seed Core Branches (BR-101 to BR-105)
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
         ON CONFLICT (code) DO NOTHING`,
        [b.code, b.name, b.city, b.status]
      );
    }

    // P0-08: Sync the sequence to 106 to prevent unique key violation collision on next admin branch creation
    try {
      await client.query(`SELECT setval('branch_code_seq', 106, false)`);
    } catch {
      // Ignore if table uses uuid or a differently named sequence
    }

    // 2. Fetch Lahore & Karachi IDs for default assignments
    const lahoreRes = await client.query("SELECT id FROM branches WHERE code = 'BR-101'");
    const lahoreId = lahoreRes.rows[0]?.id;

    const karachiRes = await client.query("SELECT id FROM branches WHERE code = 'BR-102'");
    const karachiId = karachiRes.rows[0]?.id;

    // 3. Seed All 5 Role Test Logins (Password from env or default)
    const rawPassword = process.env.SEED_PASSWORD || 'Password123!';
    const defaultPasswordHash = await AuthService.hashPassword(rawPassword);

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
      // P0-08: 5th required role login
      {
        email: 'editor@shiplens.org',
        name: 'Content Communications Editor',
        role: Role.CONTENT_EDITOR,
        branchId: null,
      },
    ];

    for (const u of seedUsers) {
      await client.query(
        `INSERT INTO users (email, password_hash, name, role, branch_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (email) DO NOTHING`,
        [u.email, defaultPasswordHash, u.name, u.role, u.branchId]
      );
    }

    // 4. Seed Baseline Collections & Weekly Reports for Dashboard Verification
    const adminUserRes = await client.query("SELECT id FROM users WHERE email = 'admin@shiplens.org'");
    const adminId = adminUserRes.rows[0]?.id;

    if (lahoreId && adminId) {
      // Seed sample collections
      const sampleCollections = [
        { date: '2026-10-12', amountPaisa: 500000, transferred: true },
        { date: '2026-10-14', amountPaisa: 250000, transferred: true },
        { date: '2026-10-19', amountPaisa: 750000, transferred: false },
        { date: '2026-10-22', amountPaisa: 300000, transferred: false },
      ];

      for (const col of sampleCollections) {
        await client.query(
          `INSERT INTO collections (branch_id, collected_by, amount_paisa, collection_date, is_locked, is_sent_to_main_account)
           VALUES ($1, $2, $3, $4, false, $5)
           ON CONFLICT DO NOTHING`,
          [lahoreId, adminId, col.amountPaisa, col.date, col.transferred]
        );
      }

      // Seed an Approved Report (Frozen Snapshot)
      const frozenMetrics = {
        approvedAt: '2026-10-19T10:00:00.000Z',
        approvedBy: adminId,
        totalAmountPaisa: '750000',
        collectionsCount: 2,
        activeMembersSnapshot: 14,
      };

      await client.query(
        `INSERT INTO weekly_reports (
           branch_id, week_start_date, week_end_date, status, total_amount_paisa, submission_notes, approved_by, frozen_metrics
         ) VALUES ($1, '2026-10-12', '2026-10-18', $2, '750000', 'Week 42 Audited Ledger', $3, $4)
         ON CONFLICT DO NOTHING`,
        [lahoreId, WeeklyReportStatus.APPROVED, adminId, JSON.stringify(frozenMetrics)]
      );

      // Seed a Pending Submitted Report
      await client.query(
        `INSERT INTO weekly_reports (
           branch_id, week_start_date, week_end_date, status, total_amount_paisa, submission_notes, submitted_by
         ) VALUES ($1, '2026-10-19', '2026-10-25', $2, '1050000', 'Week 43 Regular collections', $3)
         ON CONFLICT DO NOTHING`,
        [lahoreId, WeeklyReportStatus.SUBMITTED, adminId]
      );
    }

    // 5. Seed Initial Public Content Bulletin
    if (adminId) {
      await client.query(
        `INSERT INTO content_items (
           slug, title, summary, body, status, category, author_id, published_at
         ) VALUES (
           'nationwide-governance-summit-2026',
           'Nationwide Governance Forum 2026',
           'Annual convention of regional branch leadership and civic audit observers.',
           'ShipLens Central Secretariat convenes in Islamabad to review integer paisa financial snapshot frozen ledgers.',
           $1,
           'ANNOUNCEMENT',
           $2,
           CURRENT_TIMESTAMP
         ) ON CONFLICT (slug) DO NOTHING`,
        [ContentStatus.PUBLISHED, adminId]
      );
    }

    await client.query('COMMIT');
    console.log(`Seed completed successfully. Default password is: ${rawPassword}`);
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