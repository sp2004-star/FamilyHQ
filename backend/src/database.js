const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

// Helper: convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Convert SQLite-specific SQL to PostgreSQL-compatible SQL
function convertSQL(sql) {
  let converted = convertPlaceholders(sql);
  // datetime('now') -> NOW()
  converted = converted.replace(/datetime\(['"]now['"]\)/gi, 'NOW()');
  // date(...) function for comparisons
  converted = converted.replace(/date\(([^)]+)\)/gi, '($1)::date');
  // INTEGER DEFAULT 0 -> BOOLEAN/INTEGER (keep as-is, pg handles it)
  // INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
  converted = converted.replace(/INSERT OR IGNORE/gi, 'INSERT');
  return converted;
}

const db = {
  // Run a query that modifies data (INSERT, UPDATE, DELETE)
  run(sql, params = []) {
    const pgSql = convertSQL(sql);
    // For INSERT OR IGNORE, add ON CONFLICT DO NOTHING
    const finalSql = sql.match(/INSERT OR IGNORE/i)
      ? pgSql.replace(/VALUES\s*\([^)]+\)/i, (match) => match + ' ON CONFLICT DO NOTHING')
      : pgSql;
    return pool.query(finalSql, params);
  },

  // Get a single row
  async get(sql, params = []) {
    const result = await pool.query(convertSQL(sql), params);
    return result.rows[0] || null;
  },

  // Get all rows
  async all(sql, params = []) {
    const result = await pool.query(convertSQL(sql), params);
    return result.rows;
  },

  // Run a transaction
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txDb = {
        run(sql, params = []) {
          return client.query(convertSQL(sql), params);
        },
        async get(sql, params = []) {
          const result = await client.query(convertSQL(sql), params);
          return result.rows[0] || null;
        },
        async all(sql, params = []) {
          const result = await client.query(convertSQL(sql), params);
          return result.rows;
        },
      };
      const result = await fn(txDb);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  pool,
};

// Initialize schema
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(family_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      invited_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired', 'revoked')),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      category TEXT NOT NULL CHECK(category IN ('ID', 'Insurance', 'Medical', 'Financial', 'Education', 'Other')),
      document_type TEXT NOT NULL DEFAULT 'Other',
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('shared', 'private')),
      expiry_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS external_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reminder_log (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      days_before INTEGER NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(document_id, days_before)
    );
  `);
  console.log('📂 PostgreSQL database initialized');
}

db.initialize = initializeDatabase;

module.exports = db;
