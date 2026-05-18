import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { ecuDDL }                                              from '../models/espModel.js';
import { teamDDL }                                             from '../models/teamModel.js';
import { competitionDDL, competitionEventsDDL, competitionTeamsDDL } from '../models/competitionModel.js';
import { alertDDL }                                            from '../models/alertModel.js';

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

  db.run(ecuDDL);
  db.run(teamDDL);
  db.run(competitionDDL);
  db.run(competitionEventsDDL);
  db.run(competitionTeamsDDL);
  db.run(alertDDL);

  // Counter table (placeholder, will be removed)
  db.run(`
    CREATE TABLE IF NOT EXISTS counter_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      value       INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    )
  `);

  // Migrations for existing databases missing columns added after initial release
  try { db.run('ALTER TABLE teams ADD COLUMN power_limit INTEGER'); } catch (_) {}
  try { db.run('ALTER TABLE ecu_data ADD COLUMN avg_power REAL'); } catch (_) {}
  try { db.run('ALTER TABLE ecu_data ADD COLUMN avg_energy REAL'); } catch (_) {}
  try { db.run("ALTER TABLE alerts ADD COLUMN type TEXT DEFAULT 'penalty'"); } catch (_) {}
  try { db.run("ALTER TABLE competitions ADD COLUMN event_type TEXT DEFAULT 'drag'"); } catch (_) {}

  persist();
  console.log('SQLite ready.');
}
