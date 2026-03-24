const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './crm.db';
let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

module.exports = { getDb };
