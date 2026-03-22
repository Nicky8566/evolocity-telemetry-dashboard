import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('./evolocity.db');
let db;

export async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS counter_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      value       INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    )
  `);

  persist();
  console.log('SQLite ready.');
}

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function insertValue(value) {
  db.run(
    'INSERT INTO counter_log (value, recorded_at) VALUES (?, ?)',
    [value, new Date().toISOString()]
  );
  persist();
}

export function getAllValues() {
  const result = db.exec('SELECT * FROM counter_log ORDER BY id ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function clearAllValues() {
  db.run('DELETE FROM counter_log');
  persist();
}