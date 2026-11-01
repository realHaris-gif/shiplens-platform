import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Fail fast in production if DATABASE_URL is missing
if (process.env.NODE_ENV === 'production' && !connectionString && !process.env.DB_PASSWORD) {
  throw new Error('FATAL: DATABASE_URL (or DB credentials) must be set in production');
}

// P0-06: SSL is driven by the DB_SSL flag or explicit sslmode in the connection string,
// rather than checking host !== 'localhost' (which breaks in docker-compose where host is 'postgres').
const enableSsl =
  process.env.DB_SSL === 'true' ||
  (connectionString && (connectionString.includes('sslmode=') || connectionString.includes('render.com')));

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000, // P0-06: Set to 30s to prevent aggressive connection churn
      ssl: enableSsl ? { rejectUnauthorized: false } : false,
      max: 20,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'shiplens_user',
      password: process.env.DB_PASSWORD, // No hardcoded secret fallback
      database: process.env.DB_NAME || 'shiplens_db',
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ssl: enableSsl ? { rejectUnauthorized: false } : false,
      max: 20,
    };

export const pool = new Pool(poolConfig);