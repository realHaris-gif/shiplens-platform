import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

let config: PoolConfig;

if (connectionString) {
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  config = {
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
} else {
  config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'shiplens_user',
    password: process.env.DB_PASSWORD || 'shiplens_secret',
    database: process.env.DB_NAME || 'shiplens_db',
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
  };
}

export const pool = new Pool(config);