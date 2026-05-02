import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('./evolocity.db');
export let db;

// Throttled persist — writes to disk at most once every 500ms
// Prevents 10+ disk writes/sec at 10Hz incoming ECU data
let persistPending = false;
export function persist() {
  if (persistPending) return;
  persistPending = true;
  setTimeout(() => {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    persistPending = false;
  }, 500);
}

export async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Counter table (placeholder, will be removed later)
  db.run(`
    CREATE TABLE IF NOT EXISTS counter_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      value       INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    )
  `);

  // ECU data table
  db.run(`
    CREATE TABLE IF NOT EXISTS ecu_data (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ecu_serial      INTEGER NOT NULL,
      timestamp       TEXT NOT NULL,
      voltage_samples TEXT NOT NULL,
      current_samples TEXT,
      avg_voltage     REAL NOT NULL,
      avg_current     REAL,
      penalty         INTEGER DEFAULT 0,
      recorded_at     TEXT NOT NULL
    )
  `);

  // Teams table
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name     TEXT NOT NULL,
      team_id       TEXT NOT NULL,
      vehicle_class TEXT CHECK(vehicle_class IN ('standard', 'open')) NOT NULL,
      vehicle_type  TEXT CHECK(vehicle_type IN ('kart', 'bike')) NOT NULL,
      ecu_serial    INTEGER,
      power_limit   INTEGER
    )
  `);

  // Migrations for older DBs
  try { db.run('ALTER TABLE teams ADD COLUMN power_limit INTEGER'); } catch (_) {}
  try { db.run('ALTER TABLE ecu_data ADD COLUMN avg_power REAL'); } catch (_) {}
  try { db.run('ALTER TABLE ecu_data ADD COLUMN avg_energy REAL'); } catch (_) {}
  try { db.run("ALTER TABLE alerts ADD COLUMN type TEXT DEFAULT 'penalty'"); } catch (_) {}

  // Competitions table
  db.run(`
    CREATE TABLE IF NOT EXISTS competitions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);

  // Competition events — always 3 per competition (drag, gymkhana, endurance)
  db.run(`
    CREATE TABLE IF NOT EXISTS competition_events (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      event_type     TEXT CHECK(event_type IN ('drag', 'gymkhana', 'endurance')) NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id)
    )
  `);

  // Competition teams — links teams to competitions
  db.run(`
    CREATE TABLE IF NOT EXISTS competition_teams (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      team_id        INTEGER NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `);

  // Alerts table — one row per power-limit breach event
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ecu_serial  INTEGER NOT NULL,
      power_value REAL NOT NULL,
      threshold   REAL NOT NULL,
      started_at  TEXT NOT NULL,
      ended_at    TEXT,
      duration_ms INTEGER
    )
  `);

  persist();
  console.log('SQLite ready.');
}