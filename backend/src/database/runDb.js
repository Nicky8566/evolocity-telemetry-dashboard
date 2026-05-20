import { db, persist } from './db.js';

function rowsFromResult(result) {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

export function nextAttemptNumber(team_id, competition_id, event_type) {
  const result = db.exec(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next
     FROM runs
     WHERE team_id = ? AND competition_id = ? AND event_type = ?`,
    [team_id, competition_id, event_type]
  );
  return result[0].values[0][0];
}

export function insertRun({ team_id, competition_id, event_type, attempt_number, started_at }) {
  db.run(
    `INSERT INTO runs (team_id, competition_id, event_type, attempt_number, started_at, outcome)
     VALUES (?, ?, ?, ?, ?, 'running')`,
    [team_id, competition_id, event_type, attempt_number, started_at]
  );
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  persist();
  return id;
}

export function finaliseRun(id, { ended_at, outcome, raw_metric, raw_metric_unit }) {
  db.run(
    `UPDATE runs SET ended_at = ?, outcome = ?, raw_metric = ?, raw_metric_unit = ?
     WHERE id = ?`,
    [ended_at, outcome, raw_metric, raw_metric_unit, id]
  );
  persist();
}

export function getRunById(id) {
  const rows = rowsFromResult(db.exec('SELECT * FROM runs WHERE id = ?', [id]));
  return rows[0] ?? null;
}

export function getActiveRun(team_id, event_type) {
  const rows = rowsFromResult(db.exec(
    `SELECT * FROM runs
     WHERE team_id = ? AND event_type = ? AND outcome = 'running'
     ORDER BY id DESC LIMIT 1`,
    [team_id, event_type]
  ));
  return rows[0] ?? null;
}

export function getActiveRunForEcu(ecu_serial, event_type) {
  const rows = rowsFromResult(db.exec(
    `SELECT r.* FROM runs r
     JOIN teams t ON t.id = r.team_id
     WHERE t.ecu_serial = ? AND r.event_type = ? AND r.outcome = 'running'
     ORDER BY r.id DESC LIMIT 1`,
    [ecu_serial, event_type]
  ));
  return rows[0] ?? null;
}

export function listRuns({ team_id, competition_id, event_type } = {}) {
  const conditions = [];
  const params = [];
  if (team_id != null)        { conditions.push('team_id = ?');        params.push(team_id); }
  if (competition_id != null) { conditions.push('competition_id = ?'); params.push(competition_id); }
  if (event_type != null)     { conditions.push('event_type = ?');     params.push(event_type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return rowsFromResult(db.exec(`SELECT * FROM runs ${where} ORDER BY id ASC`, params));
}
