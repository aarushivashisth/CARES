import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dbFilePath = path.isAbsolute(config.databasePath)
  ? config.databasePath
  : path.resolve(__dirname, '../../', config.databasePath);

const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database instance
let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbFilePath);
    // Enable foreign key constraints
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}

/**
 * Data access abstraction layer to decouple controllers from raw SQLite implementation.
 * Facilitates straightforward future migration to PostgreSQL or MySQL.
 */
export const db = {
  /**
   * Execute raw SQL statements (for schema definitions and migrations)
   */
  exec(sql) {
    return getDb().exec(sql);
  },

  /**
   * Fetch all matching records
   */
  all(sql, params = []) {
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
  },

  /**
   * Fetch a single matching record
   */
  get(sql, params = []) {
    const stmt = getDb().prepare(sql);
    return stmt.get(...params);
  },

  /**
   * Execute an INSERT / UPDATE / DELETE command
   * Returns { changes, lastInsertRowid }
   */
  run(sql, params = []) {
    const stmt = getDb().prepare(sql);
    return stmt.run(...params);
  },

  /**
   * Execute multiple operations within an atomic transaction
   */
  transaction(callback) {
    const database = getDb();
    database.exec('BEGIN TRANSACTION;');
    try {
      const result = callback(db);
      database.exec('COMMIT;');
      return result;
    } catch (err) {
      database.exec('ROLLBACK;');
      throw err;
    }
  },

  /**
   * Close database connection
   */
  close() {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  }
};
