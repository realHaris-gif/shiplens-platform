import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

let migrationsRun = false;

export async function runMigrations(): Promise<void> {
  // 1. Guard against multiple runs within the same process (e.g. jest runInBand)
  if (migrationsRun) {
    return;
  }

  const client = await pool.connect();
  try {
    // 2. Fast-check: if core schema tables already exist, skip re-executing DDL
    const checkRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'collections', 'content_items')
    `);

    if (checkRes.rows.length >= 2) {
      migrationsRun = true;
      return;
    }

    console.log('Running database migrations...');
    await client.query('BEGIN');

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = ['001_initial_schema.sql', '002_content_schema.sql'];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
      }
    }

    await client.query('COMMIT');
    migrationsRun = true;
    console.log('Migrations applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct CLI execution: ts-node src/db/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}