const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS financial_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,
    record_type TEXT NOT NULL DEFAULT 'annual', -- 'annual' | 'monthly'
    elapsed_months REAL,
    sales REAL NOT NULL,
    ordinary_profit REAL NOT NULL,
    total_assets REAL NOT NULL,
    equity REAL NOT NULL,
    current_assets REAL NOT NULL,
    current_liabilities REAL NOT NULL,
    employees REAL NOT NULL,
    value_added REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
  CREATE INDEX IF NOT EXISTS idx_records_company ON financial_records(company_id);
`);

// ---- 簡易マイグレーション: 既存のDBファイルに新しい列を後から追加する ----
// (すでにテスト運用しているユーザーのapp.sqliteを壊さないよう、
//  CREATE TABLE ではなく ALTER TABLE ADD COLUMN で後方互換に追加する)
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some(c => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('financial_records', 'interest_bearing_debt', 'REAL');
ensureColumn('financial_records', 'depreciation', 'REAL');

module.exports = db;
