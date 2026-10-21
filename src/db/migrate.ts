import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const migrationFile = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Running database migrations...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
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