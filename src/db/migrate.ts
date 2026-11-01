import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

let migrationsRun = false;

export async function runMigrations(): Promise<void> {
  // Prevent duplicate execution within the same running process
  if (migrationsRun) {
    return;
  }

  const client = await pool.connect();
  const ADVISORY_LOCK_ID = 748392; // Unique advisory lock ID for ShipLens migrations

  try {
    // P0-11: Take a PostgreSQL session-level advisory lock so concurrent instances cannot race
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);

    // 1. Create migration history tracking table if not present
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 2. Fetch all previously executed migrations
    const appliedRes = await client.query('SELECT filename FROM schema_migrations');
    const appliedFiles = new Set(appliedRes.rows.map((r: { filename: string }) => r.filename));

    // 3. Resolve migrations directory (handles both ts-node /src and built /dist environments)
    let migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
    }
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.resolve(process.cwd(), 'dist/db/migrations');
    }

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    // 4. Read and sort all .sql migration files sequentially
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (files.length === 0) {
      console.warn('No .sql migration files found in migrations directory.');
      migrationsRun = true;
      return;
    }

    // 5. Apply each unapplied migration inside its own transaction
    for (const file of files) {
      if (!appliedFiles.has(file)) {
        console.log(`Applying database migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Successfully applied: ${file}`);
        } catch (migrationErr) {
          await client.query('ROLLBACK');
          console.error(`Migration failed on file: ${file}`, migrationErr);
          throw migrationErr;
        }
      }
    }

    migrationsRun = true;
    console.log('Database migrations verification complete.');
  } finally {
    try {
      // Release advisory lock and return client to pool
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
    } catch (_) {
      // Lock will automatically clear when client disconnects
    }
    client.release();
  }
}

// Allow direct CLI execution: ts-node src/db/migrate.ts or node dist/db/migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}