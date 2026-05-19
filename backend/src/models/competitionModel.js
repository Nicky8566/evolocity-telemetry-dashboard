// competitionModel — shape and DDL for competition-related tables

export const competitionSchema = {
  id:         'INTEGER PRIMARY KEY AUTOINCREMENT',
  name:       'TEXT NOT NULL UNIQUE',
  event_type: "TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance')) NOT NULL DEFAULT 'drag'",
  created_at: 'TEXT NOT NULL',
};

export const competitionEventSchema = {
  id:             'INTEGER PRIMARY KEY AUTOINCREMENT',
  competition_id: 'INTEGER NOT NULL',
  event_type:     "TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance')) NOT NULL",
};

export const competitionTeamSchema = {
  id:             'INTEGER PRIMARY KEY AUTOINCREMENT',
  competition_id: 'INTEGER NOT NULL',
  team_id:        'INTEGER NOT NULL',
};

export const competitionDDL = `
  CREATE TABLE IF NOT EXISTS competitions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    event_type TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance')) NOT NULL DEFAULT 'drag',
    created_at TEXT NOT NULL
  )
`;

export const competitionEventsDDL = `
  CREATE TABLE IF NOT EXISTS competition_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL,
    event_type     TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance')) NOT NULL,
    FOREIGN KEY (competition_id) REFERENCES competitions(id)
  )
`;

export const competitionTeamsDDL = `
  CREATE TABLE IF NOT EXISTS competition_teams (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL,
    team_id        INTEGER NOT NULL,
    FOREIGN KEY (competition_id) REFERENCES competitions(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
  )
`;
