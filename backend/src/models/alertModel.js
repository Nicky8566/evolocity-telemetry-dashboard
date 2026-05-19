// alertModel — shape and DDL for the alerts table

export const alertSchema = {
  id:          'INTEGER PRIMARY KEY AUTOINCREMENT',
  ecu_serial:  'INTEGER NOT NULL',
  power_value: 'REAL NOT NULL',     // peak power during the breach in watts
  threshold:   'REAL NOT NULL',     // power limit that was exceeded
  started_at:  'TEXT NOT NULL',     // ISO timestamp when breach began
  ended_at:    'TEXT',              // ISO timestamp when power dropped below limit — null if ongoing
  duration_ms: 'INTEGER',           // total breach duration — null until ended
  type:        "TEXT NOT NULL DEFAULT 'warning'",  // 'warning' (< 1s) or 'penalty' (≥ 1s)
};

export const alertDDL = `
  CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ecu_serial  INTEGER NOT NULL,
    power_value REAL NOT NULL,
    threshold   REAL NOT NULL,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    duration_ms INTEGER,
    type        TEXT NOT NULL DEFAULT 'warning'
  )
`;
