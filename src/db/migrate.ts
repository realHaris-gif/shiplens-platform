import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(987654321)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Detect existing column name in case schema_migrations pre-existed with another column
    const colCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schema_migrations'
    `);
    const cols = colCheck.rows.map((r: { column_name: string }) => r.column_name.toLowerCase());

    let versionCol = 'version';
    if (!cols.includes('version')) {
      if (cols.includes('name')) versionCol = 'name';
      else if (cols.includes('migration_name')) versionCol = 'migration_name';
      else if (cols.includes('filename')) versionCol = 'filename';
      else {
        // Fallback: add version column
        await client.query('ALTER TABLE schema_migrations ADD COLUMN version VARCHAR(255)');
        versionCol = 'version';
      }
    }

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      throw new Error(`No migration .sql files found in ${migrationsDir}`);
    }

    for (const file of files) {
      const checkRes = await client.query(
        `SELECT ${versionCol} FROM schema_migrations WHERE ${versionCol} = $1`,
        [file]
      );

      if (checkRes.rows.length === 0) {
        console.log(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            `INSERT INTO schema_migrations (${versionCol}) VALUES ($1)`,
            [file]
          );
          await client.query('COMMIT');
          console.log(`Migration ${file} applied successfully.`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Migration ${file} failed:`, err);
          throw err;
        }
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(987654321)');
    } catch (_) {}
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('All migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal migration failure:', err);
      process.exit(1);
    });
}