// runModel — shape and DDL for the runs table.
// A "run" is one attempt at one event by one team in one competition.
// Drag allows up to 5 attempts; Gymkhana up to 2; Endurance/Efficiency 1 (rules RE.2-5).

export const RUN_OUTCOMES = ['running', 'finished', 'dnf', 'dq', 'dns'];
export const RUN_METRIC_UNITS = ['seconds', 'wh'];

export const runSchema = {
  id:              'INTEGER PRIMARY KEY AUTOINCREMENT',
  team_id:         'INTEGER NOT NULL',
  competition_id:  'INTEGER NOT NULL',
  event_type:      "TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance', 'efficiency')) NOT NULL",
  attempt_number:  'INTEGER NOT NULL',
  started_at:      'TEXT NOT NULL',
  ended_at:        'TEXT',
  outcome:         "TEXT CHECK(outcome IN ('running', 'finished', 'dnf', 'dq', 'dns')) NOT NULL DEFAULT 'running'",
  raw_metric:      'REAL',
  raw_metric_unit: "TEXT CHECK(raw_metric_unit IN ('seconds', 'wh'))",
};

export const runDDL = `
  CREATE TABLE IF NOT EXISTS runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id         INTEGER NOT NULL,
    competition_id  INTEGER NOT NULL,
    event_type      TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance', 'efficiency')) NOT NULL,
    attempt_number  INTEGER NOT NULL,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    outcome         TEXT CHECK(outcome IN ('running', 'finished', 'dnf', 'dq', 'dns')) NOT NULL DEFAULT 'running',
    raw_metric      REAL,
    raw_metric_unit TEXT CHECK(raw_metric_unit IN ('seconds', 'wh')),
    UNIQUE (team_id, competition_id, event_type, attempt_number),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (competition_id) REFERENCES competitions(id)
  )
`;
