import { db, persist } from './db.js';

export function insertCompetition(name, event_type) {
  db.run(
    'INSERT INTO competitions (name, event_type, created_at) VALUES (?, ?, ?)',
    [name, event_type, new Date().toISOString()]
  );
  const result = db.exec('SELECT last_insert_rowid() AS id');
  const competitionId = result[0].values[0][0];
  persist();
  return competitionId;
}

export function getAllCompetitions() {
  const result = db.exec('SELECT * FROM competitions ORDER BY id ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function getCompetitionById(id) {
  const compResult = db.exec('SELECT * FROM competitions WHERE id = ?', [id]);
  if (compResult.length === 0) return null;

  const comp = Object.fromEntries(
    compResult[0].columns.map((col, i) => [col, compResult[0].values[0][i]])
  );

  const teamsResult = db.exec(
    `SELECT t.* FROM teams t
     JOIN competition_teams ct ON ct.team_id = t.id
     WHERE ct.competition_id = ?`,
    [id]
  );
  comp.teams = teamsResult.length > 0
    ? teamsResult[0].values.map(row =>
        Object.fromEntries(teamsResult[0].columns.map((col, i) => [col, row[i]]))
      )
    : [];

  return comp;
}

export function addTeamToCompetition(competition_id, team_id) {
  const existing = db.exec(
    'SELECT id FROM competition_teams WHERE competition_id = ? AND team_id = ?',
    [competition_id, team_id]
  );
  if (existing.length > 0 && existing[0].values.length > 0) return false;
  db.run(
    'INSERT INTO competition_teams (competition_id, team_id) VALUES (?, ?)',
    [competition_id, team_id]
  );
  persist();
  return true;
}

export function removeTeamFromCompetition(competition_id, team_id) {
  db.run(
    'DELETE FROM competition_teams WHERE competition_id = ? AND team_id = ?',
    [competition_id, team_id]
  );
  persist();
}

export function competitionNameExists(name) {
  const result = db.exec(
    'SELECT COUNT(*) as count FROM competitions WHERE name = ?',
    [name]
  );
  return result[0].values[0][0] > 0;
}