import { Pool } from 'pg';

// Database connection helper used by Conto Termico Netlify functions.
// This module exposes a Pool instance configured via environment variables.
// It mirrors the implementation from the NUOVA repository so that code
// copied from NUOVA continues to function without modification.

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.DB_URL;

// When running in production we expect a valid connection string. In
// development environments the functions will throw a descriptive error if
// the connection string is missing.
const isProd = process.env.NODE_ENV === 'production';

if (!connectionString && isProd) {
  throw new Error('DATABASE_URL non configurata');
}

// Lazily instantiate the PostgreSQL connection pool. We rely on SSL with
// rejectUnauthorized set to false to support managed databases such as
// Supabase. When no connection string is provided (e.g. local
// development) the pool remains null and functions will throw an error.
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

/**
 * Obtain a client from the pool. Throws if the pool is not initialized.
 */
export function getClient() {
  if (!pool) {
    const err = new Error('DATABASE_URL non configurata (ambiente di sviluppo)');
    err.statusCode = 500;
    throw err;
  }
  return pool;
}

/**
 * Run a query using the default pool. This is a convenience wrapper around
 * pool.query that logs errors to the console.
 *
 * @param {string} text The SQL statement to execute.
 * @param {Array} params The bound parameters.
 * @returns {Promise<object>} The query result.
 */
export async function query(text, params) {
  if (!pool) {
    const err = new Error('DATABASE_URL non configurata (ambiente di sviluppo)');
    err.statusCode = 500;
    throw err;
  }

  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('DB error:', err);
    throw err;
  }
}
