import { db, persist } from './db.js';

// Helper function to convert SQL result to array of objects
function rowsFromResult(result) {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function insertTeam(team) {
  db.run(
    `INSERT INTO teams (team_name, team_id, vehicle_class, vehicle_type, ecu_serial, power_limit, current_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      team.team_name,
      team.team_id,
      team.vehicle_class,
      team.vehicle_type,
      team.ecu_serial ?? null,
      team.power_limit ?? null,
      team.current_limit ?? null,
    ]
  );
  const result = db.exec('SELECT last_insert_rowid() AS id');
  const id = result[0].values[0][0];
  persist();
  return id;
}

export function updateTeamPowerLimit(id, power_limit) {
  db.run(
    'UPDATE teams SET power_limit = ? WHERE id = ?',
    [power_limit ?? null, id]
  );
  persist();
}

export function updateTeamCurrentLimit(id, current_limit) {
  db.run(
    'UPDATE teams SET current_limit = ? WHERE id = ?',
    [current_limit ?? null, id]
  );
  persist();
}

export function getAllTeams() {
  const result = db.exec('SELECT * FROM teams ORDER BY id ASC');
  return rowsFromResult(result);
}

// Fixed SQL injection — now uses ? placeholders
export function updateTeamEcu(team) {
  db.run(
    'UPDATE teams SET ecu_serial = ? WHERE id = ?',
    [team.ecu_serial ?? null, team.id]
  );
  persist();
}

// Fixed SQL injection — now uses ? placeholder
export function getTeamByEcu(ecu_serial) {
  const result = db.exec(
    'SELECT * FROM teams WHERE ecu_serial = ?',
    [ecu_serial]
  );
  return rowsFromResult(result);
}

export function getTeamByName(team_name) {
  const result = db.exec(
    'SELECT * FROM teams WHERE LOWER(team_name) = LOWER(?)',
    [team_name]
  );
  return rowsFromResult(result);
}

export function getTeamByTeamId(team_id) {
  const result = db.exec(
    'SELECT * FROM teams WHERE LOWER(team_id) = LOWER(?)',
    [team_id]
  );
  return rowsFromResult(result);
}

export function getTeamById(id) {
  const result = db.exec('SELECT * FROM teams WHERE id = ?', [id]);
  const rows = rowsFromResult(result);
  return rows[0] ?? null;
}

export function deleteTeamById(id) {
  const existing = getTeamById(id);
  if (!existing) return false;

  // Delete related entries in competition_teams first to maintain referential integrity
  db.run('DELETE FROM competition_teams WHERE team_id = ?', [id]);
  db.run('DELETE FROM teams WHERE id = ?', [id]);

  persist();
  return true;
}
