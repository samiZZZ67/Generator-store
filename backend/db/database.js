'use strict';
/**
 * database.js — Dual support for PostgreSQL (production/Render) and sql.js (local fallback).
 * Uses parameter translation so routes can write SQLite-style queries ($param) and run on either.
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, '../../data/store.db');

let _db = null; // SQLite db instance
let _pool = null; // Postgres pool instance
let isPostgres = false;

// Check for Database connection strings
const dbUrl = process.env.DATABASE_URL || process.env.CLOUDINARY_DATABASE_URL || process.env.CLOUDINARY_DB_URL;
if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  isPostgres = true;
  const { Pool } = require('pg');
  _pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required for Render Postgres
  });
}

/* ─── Parameter Converter ────────────────────────────────────────────────────── */
function convertSqlAndParams(sql, params) {
  if (!params) return { sql, values: [] };
  
  const values = [];
  let paramIndex = 1;
  const paramMap = {};
  
  // Find all named parameters like $name, :name, @name
  const regex = /([$:@])([a-zA-Z0-9_]+)/g;
  
  const convertedSql = sql.replace(regex, (match, prefix, name) => {
    if (!(name in paramMap)) {
      paramMap[name] = paramIndex++;
      let val = params[name];
      if (val === undefined) val = params['$' + name];
      if (val === undefined) val = params[':' + name];
      if (val === undefined) val = params['@' + name];
      values.push(val === undefined ? null : val);
    }
    return '$' + paramMap[name];
  });
  
  return { sql: convertedSql, values };
}

/* ─── Bootstrap ─────────────────────────────────────────────────────────────── */
async function getDb() {
  if (isPostgres) {
    // Return a client wrapper or pool itself. We'll return pool for simple queries.
    if (!_pool) {
      const { Pool } = require('pg');
      _pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
    }
    await applySchemaPostgres();
    return _pool;
  }

  // SQLite Fallback
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const SQL = await initSqlJs();
  _db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();
  _db.run("PRAGMA foreign_keys = ON;");
  applySchemaSqlite();
  saveDb();
  return _db;
}

function saveDb() {
  if (isPostgres || !_db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

async function applySchemaPostgres() {
  const client = await _pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY, 
        label_am TEXT NOT NULL, 
        label_en TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name_am TEXT NOT NULL, 
        name_en TEXT NOT NULL,
        cat_id TEXT NOT NULL REFERENCES categories(id),
        price INTEGER NOT NULL,
        original_price INTEGER,
        marketing_desc_am TEXT DEFAULT '',
        marketing_desc_en TEXT DEFAULT '',
        in_stock INTEGER NOT NULL DEFAULT 1,
        icon TEXT NOT NULL DEFAULT '⚡',
        desc_am TEXT NOT NULL DEFAULT '', 
        desc_en TEXT NOT NULL DEFAULT '',
        image_url TEXT, 
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(cat_id);
      CREATE INDEX IF NOT EXISTS idx_prod_active ON products(active);
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, 
        channel TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'am', 
        customer_wa TEXT, 
        note TEXT,
        total_etb INTEGER NOT NULL DEFAULT 0, 
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        qty INTEGER NOT NULL DEFAULT 1, 
        unit_price INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);
      CREATE TABLE IF NOT EXISTS enquiries (
        id SERIAL PRIMARY KEY,
        lang TEXT NOT NULL DEFAULT 'am', 
        message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("Error applying Postgres schema:", err);
  } finally {
    client.release();
  }
}

function applySchemaSqlite() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, label_am TEXT NOT NULL, label_en TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_am TEXT NOT NULL, name_en TEXT NOT NULL,
      cat_id TEXT NOT NULL REFERENCES categories(id),
      price INTEGER NOT NULL,
      original_price INTEGER,
      marketing_desc_am TEXT DEFAULT '',
      marketing_desc_en TEXT DEFAULT '',
      in_stock INTEGER NOT NULL DEFAULT 1,
      icon TEXT NOT NULL DEFAULT '⚡',
      desc_am TEXT NOT NULL DEFAULT '', desc_en TEXT NOT NULL DEFAULT '',
      image_url TEXT, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_prod_cat    ON products(cat_id);
    CREATE INDEX IF NOT EXISTS idx_prod_active ON products(active);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, channel TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'am', customer_wa TEXT, note TEXT,
      total_etb INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL DEFAULT 1, unit_price INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lang TEXT NOT NULL DEFAULT 'am', message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure new columns are added to SQLite if the database already existed
  try { _db.exec("ALTER TABLE products ADD COLUMN original_price INTEGER;"); } catch (e) {}
  try { _db.exec("ALTER TABLE products ADD COLUMN marketing_desc_am TEXT DEFAULT '';"); } catch (e) {}
  try { _db.exec("ALTER TABLE products ADD COLUMN marketing_desc_en TEXT DEFAULT '';"); } catch (e) {}
}

/* ─── Internal SQLite query helpers ─────────────────────────────────────────── */
function _toBindObj(params) {
  if (!params) return null;
  if (Array.isArray(params)) return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out['$' + k.replace(/^[@:$]/, '')] = (v === undefined ? null : v);
  }
  return out;
}

function _execRows(db, sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(_toBindObj(params));
  const cols = stmt.getColumnNames();
  const rows = [];
  while (stmt.step()) {
    const vals = stmt.get();
    const obj  = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

function _lastMeta(db) {
  const res = db.exec("SELECT last_insert_rowid() AS lid, changes() AS ch");
  const row = res[0]?.values[0] || [0, 0];
  return { lastInsertRowid: row[0], changes: row[1] };
}

/* ─── Public API ─────────────────────────────────────────────────────────────── */

let _inTransaction = false;

module.exports = {
  getDb,
  saveDb,
  isPostgres() {
    return isPostgres;
  },
  transaction(db, fn) {
    if (isPostgres) {
      // Postgres transactional helper
      return async (...args) => {
        const client = await db.connect();
        try {
          await client.query("BEGIN;");
          // Re-bind getDb to return the transactional client inside the function
          const result = await fn(client, ...args);
          await client.query("COMMIT;");
          return result;
        } catch (e) {
          await client.query("ROLLBACK;");
          throw e;
        } finally {
          client.release();
        }
      };
    }

    // SQLite transactional helper
    return (...args) => {
      db.run("BEGIN;");
      try {
        _inTransaction = true;
        const result = fn(db, ...args);
        _inTransaction = false;
        db.run("COMMIT;");
        saveDb();
        return result;
      } catch (e) {
        _inTransaction = false;
        try { db.run("ROLLBACK;"); } catch (_) {}
        throw e;
      }
    };
  },

  prepare(db, sql) {
    if (isPostgres) {
      return {
        async all(params) {
          const { sql: finalSql, values } = convertSqlAndParams(sql, params);
          const res = await db.query(finalSql, values);
          return res.rows;
        },
        async get(params) {
          const { sql: finalSql, values } = convertSqlAndParams(sql, params);
          const res = await db.query(finalSql, values);
          return res.rows[0] || null;
        },
        async run(params) {
          // If inserting, automatically append RETURNING id for lastInsertRowid compatibility
          let finalSql = sql;
          if (sql.trim().toUpperCase().startsWith('INSERT ')) {
            if (!sql.toUpperCase().includes('RETURNING')) {
              finalSql = sql + ' RETURNING id';
            }
          }
          const { sql: querySql, values } = convertSqlAndParams(finalSql, params);
          const res = await db.query(querySql, values);
          
          let lastInsertRowid = null;
          if (res.rows && res.rows[0]) {
            lastInsertRowid = res.rows[0].id || res.rows[0].lastval || null;
          }
          return {
            lastInsertRowid,
            changes: res.rowCount
          };
        }
      };
    }

    // SQLite prepared statement wrapper (async-wrapped to support identical API in routes)
    return {
      async all(params) { 
        return _execRows(db, sql, params); 
      },
      async get(params) { 
        return _execRows(db, sql, params)[0] || null; 
      },
      async run(params) {
        db.run(sql, _toBindObj(params));
        const meta = _lastMeta(db);
        if (!_inTransaction) saveDb();
        return meta;
      }
    };
  }
};
