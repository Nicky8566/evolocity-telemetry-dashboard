import { db, persist } from './db.js';

function rowsFromResult(result) {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

export function insertPenalty({ run_id, penalty_type, value, unit, source = 'judge', note = null, applied_by = null }) {
  db.run(
    `INSERT INTO penalties (run_id, penalty_type, value, unit, source, note, applied_at, applied_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [run_id, penalty_type, value, unit, source, note, new Date().toISOString(), applied_by]
  );
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  persist();
  return id;
}

export function updatePenalty(id, { value, unit, note }) {
  // Update only the fields that were provided.
  const sets = [];
  const params = [];
  if (value !== undefined) { sets.push('value = ?'); params.push(value); }
  if (unit  !== undefined) { sets.push('unit = ?');  params.push(unit); }
  if (note  !== undefined) { sets.push('note = ?');  params.push(note); }
  if (sets.length === 0) return;
  params.push(id);
  db.run(`UPDATE penalties SET ${sets.join(', ')} WHERE id = ?`, params);
  persist();
}

export function deletePenalty(id) {
  db.run('DELETE FROM penalties WHERE id = ?', [id]);
  persist();
}

export function getPenaltyById(id) {
  const rows = rowsFromResult(db.exec('SELECT * FROM penalties WHERE id = ?', [id]));
  return rows[0] ?? null;
}

export function listPenaltiesByRun(run_id) {
  return rowsFromResult(db.exec(
    'SELECT * FROM penalties WHERE run_id = ? ORDER BY id ASC',
    [run_id]
  ));
}

// Returns the most-recent auto-sourced power_zone penalty for a run, if any.
// Used by the alerts->penalties bridge to upsert one row per breach.
export function getLatestAutoPowerZonePenalty(run_id) {
  const rows = rowsFromResult(db.exec(
    `SELECT * FROM penalties
     WHERE run_id = ? AND source = 'auto' AND penalty_type = 'power_zone'
     ORDER BY id DESC LIMIT 1`,
    [run_id]
  ));
  return rows[0] ?? null;
}
