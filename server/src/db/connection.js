import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

let _db = null;

function getDb() {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is required for database operations. ' +
      'The planning engines work without a database using synthetic data.'
    );
  }
  const client = postgres(connectionString);
  _db = drizzle(client, { schema });
  return _db;
}

// Lazy proxy — only throws when a DB operation is actually attempted
export const db = new Proxy({}, {
  get(_, prop) {
    return getDb()[prop];
  },
});
