import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const isProduction = process.env.NODE_ENV === 'production';
const isLocal = !connectionString || connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: isProduction && !isLocal ? { rejectUnauthorized: false } : false,
});