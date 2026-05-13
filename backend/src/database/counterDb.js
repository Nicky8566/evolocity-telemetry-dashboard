import { db, persist } from './db.js';

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