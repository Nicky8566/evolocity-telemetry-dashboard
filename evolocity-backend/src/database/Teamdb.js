import { db, persist } from './db.js';

export function insertTeam(team) {
  db.run(
    `INSERT INTO teams (team_name, team_id, vehicle_class, vehicle_type, ecu_serial, power_limit)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      team.team_name,
      team.team_id,
      team.vehicle_class,
      team.vehicle_type,
      team.ecu_serial ?? null,
      team.power_limit ?? null,
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

export function getAllTeams() {
  const result = db.exec('SELECT * FROM teams ORDER BY id ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
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
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function getTeamByName(team_name) {
  const result = db.exec(
    'SELECT * FROM teams WHERE team_name = ?',
    [team_name]
  );
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function getTeamByTeamId(team_id) {
  const result = db.exec(
    'SELECT * FROM teams WHERE team_id = ?',
    [team_id]
  );
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}