import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { StorageError } from '../errors/index.js';

let SQL = null;

/**
 * Initializes SQL.js WASM engine
 */
export async function getSqlEngine() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

/**
 * Ensures directory exists
 */
function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Opens or creates SQLite database file
 * @param {string} dbPath
 * @returns {Promise<{ db: any, save: () => void }>}
 */
export async function openDatabase(dbPath = './.goalthread/goalthread.db') {
  try {
    ensureDirExists(dbPath);
    const sql = await getSqlEngine();

    let db;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new sql.Database(fileBuffer);
    } else {
      db = new sql.Database();
    }

    // Initialize DDL tables
    initSchema(db);

    const save = () => {
      try {
        ensureDirExists(dbPath);
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
      } catch (err) {
        throw new StorageError(`Failed to save database to disk: ${err.message}`, { cause: err });
      }
    };

    // Initial save to persist schema
    save();

    return { db, save };
  } catch (err) {
    throw new StorageError(`Failed to open SQLite database: ${err.message}`, { cause: err });
  }
}

/**
 * Initializes database table structures according to PRD Section 25
 */
function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      status TEXT NOT NULL,
      phase TEXT,
      progress REAL DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      estimated_cost REAL DEFAULT 0,
      config_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goal_specifications (
      goal_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      phase_id TEXT,
      sequence INTEGER,
      title TEXT,
      status TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_results (
      task_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL,
      data_json TEXT NOT NULL,
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supervisor_reviews (
      review_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      score REAL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      task_id TEXT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      checksum TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);
}
