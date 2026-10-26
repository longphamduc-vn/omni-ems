const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, 'ems.db');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const SEED_FILE = path.join(__dirname, 'seed.sql');

class DatabaseManager {
  constructor() {
    this.db = new DatabaseSync(DB_FILE);
    this.initIfEmpty();
  }

  initIfEmpty() {
    try {
      const row = this.db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='items'").get();
      const transRow = this.db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='translations'").get();
      if (!row || row.count === 0) {
        console.log('[DB] Database is uninitialized. Running schema and seed...');
        this.reset();
      } else if (!transRow || transRow.count === 0) {
        console.log('[DB] Translations table missing. Running schema and seed updates...');
        const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
        this.db.exec(schemaSql);
        const seedSql = fs.readFileSync(SEED_FILE, 'utf8');
        this.db.exec(seedSql);
        console.log('[DB] Translations table initialized successfully.');
      }
    } catch (e) {
      console.log('[DB] Initializing database...');
      this.reset();
    }
  }

  reset() {
    const tables = [
      'prv_requests', 'work_orders', 'translations', 'factories',
      'common_codes', 'item_po_history', 'target_stock',
      'estimate_requests', 'item_usage_summary', 'inventory', 'items'
    ];
    for (const t of tables) {
      try { this.db.exec(`DROP TABLE IF EXISTS ${t}`); } catch (e) {}
    }
    const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    this.db.exec(schemaSql);
    const seedSql = fs.readFileSync(SEED_FILE, 'utf8');
    this.db.exec(seedSql);
    console.log('[DB] Database reset and seeded successfully.');
  }

  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  run(sql, params = []) {
    return this.db.prepare(sql).run(...params);
  }
}

const db = new DatabaseManager();
module.exports = db;
