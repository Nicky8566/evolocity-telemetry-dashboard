// penaltyModel — judge-applied or auto-derived penalties attached to a run.
// Source 'auto' means the row was generated from a power-limit alert (rules RE.5.1.b);
// judges can still edit or delete these if the calculation needs adjusting.

export const PENALTY_TYPES = [
  'cone_hit',
  'false_start',
  'failure_to_stop',
  'course_cut',
  'dangerous',
  'power_zone',
  'dnf',
  'dq',
  'dns',
  'other',
];

export const PENALTY_UNITS = ['seconds', 'points'];
export const PENALTY_SOURCES = ['judge', 'auto'];

export const penaltySchema = {
  id:           'INTEGER PRIMARY KEY AUTOINCREMENT',
  run_id:       'INTEGER NOT NULL',
  penalty_type: 'TEXT NOT NULL',
  value:        'REAL NOT NULL',
  unit:         "TEXT CHECK(unit IN ('seconds', 'points')) NOT NULL",
  source:       "TEXT CHECK(source IN ('judge', 'auto')) NOT NULL DEFAULT 'judge'",
  note:         'TEXT',
  applied_at:   'TEXT NOT NULL',
  applied_by:   'TEXT',
};

export const penaltyDDL = `
  CREATE TABLE IF NOT EXISTS penalties (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       INTEGER NOT NULL,
    penalty_type TEXT NOT NULL,
    value        REAL NOT NULL,
    unit         TEXT CHECK(unit IN ('seconds', 'points')) NOT NULL,
    source       TEXT CHECK(source IN ('judge', 'auto')) NOT NULL DEFAULT 'judge',
    note         TEXT,
    applied_at   TEXT NOT NULL,
    applied_by   TEXT,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  )
`;
