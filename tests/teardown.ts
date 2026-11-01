import { pool } from '../src/config/db';

export default async function globalTeardown() {
  await pool.end();
}