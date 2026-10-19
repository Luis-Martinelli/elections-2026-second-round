import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import fs from 'fs';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function isSqlHostConfigured(): boolean {
  const host = process.env.SQL_HOST;
  if (!host) return false;
  if (host.startsWith('/')) {
    return fs.existsSync(host);
  }
  return true;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    global._postgresPool.on('error', (err) => {
      console.warn('SQL pool client notice:', err.message || err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

