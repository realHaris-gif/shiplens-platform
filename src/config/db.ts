import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'shiplens_user',
  password: process.env.DB_PASSWORD || 'shiplens_secret',
  database: process.env.DB_NAME || 'shiplens_db',
  ssl: process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.includes('localhost') 
    ? { rejectUnauthorized: false } 
    : false,
});