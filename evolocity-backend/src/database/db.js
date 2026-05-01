import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('./evolocity.db');
let db;

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

  // ECU data table — matches simulator field names
  db.run(`
    CREATE TABLE IF NOT EXISTS ecu_data (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ecu_serial      INTEGER NOT NULL,
      timestamp       TEXT NOT NULL,
      voltage_samples TEXT NOT NULL,
      avg_voltage     REAL NOT NULL,
      avg_current     REAL,
      penalty         INTEGER DEFAULT 0,
      recorded_at     TEXT NOT NULL
    )
  `);

  // Teams table
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name       STRING NOT NULL,
      team_id         STRING NOT NULL,
      vehicle_class   STRING NOT NULL,
      vehicle_type    STRING NOT NULL,
      ecu_serial      INTEGER
    )
  `)

  persist();
  console.log('SQLite ready.');
}

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Counter (placeholder) ─────────────────────────────────────────────────────

export function insertValue(value) {
  db.run(
    'INSERT INTO counter_log (value, recorded_at) VALUES (?, ?)',
    [value, new Date().toISOString()]
  );
  persist();
}

export function getAllValues() {
  const result = db.exec('SELECT * FROM counter_log ORDER BY id ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function clearAllValues() {
  db.run('DELETE FROM counter_log');
  persist();
}

// ── ECU Data ──────────────────────────────────────────────────────────────────

export function insertECUFrame(frame) {
  db.run(
    `INSERT INTO ecu_data
      (ecu_serial, timestamp, voltage_samples, avg_voltage, avg_current, penalty, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      frame.ecu_serial,
      frame.timestamp,
      JSON.stringify(frame.voltage_samples),  // store array as JSON string
      frame.avg_voltage,
      frame.avg_current ?? null,
      frame.penalty ? 1 : 0,
      new Date().toISOString()
    ]
  );
  persist();
}

export function getAllECUFrames() {
  const result = db.exec('SELECT * FROM ecu_data ORDER BY id ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]));
    obj.voltage_samples = JSON.parse(obj.voltage_samples); // parse back to array
    return obj;
  });
}

// ── Team Data ─────────────────────────────────────────────────────────────────

export function insertTeam(team) {
  db.run(
    `INSERT INTO teams
      (team_name, team_id, vehicle_class, vehicle_type, ecu_serial)
     VALUES (?, ?, ?, ?, ?)`,
    [
      team.team_name,
      team.team_id,
      team.vehicle_class,
      team.vehicle_type,
      team.ecu_serial ?? null,
    ]
  );
  persist();
}

export function getAllTeams() {
  const result = db.exec('SELECT * FROM teams ORDER BY id ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]));
    return obj;
  });
}

export function updateTeamEcu(team) {
  db.run(`
    UPDATE teams
    SET ecu_serial = ${team.ecu_serial} 
    WHERE id = ${team.id}  
  `);
  persist();
}

export function getTeamByEcu(ecu_serial) {
  const result = db.exec(`SELECT * FROM teams WHERE ecu_serial = ${ecu_serial}`);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]));
    return obj;
  });
}

export function getTeamByName(team_name) {
  console.log("hello");
  const result = db.exec(`SELECT * FROM teams WHERE team_name = ?`,[team_name]);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]));
    return obj;
  });
}

export function getTeamByTeamId(team_id) {
  console.log("hello");
  const result = db.exec(`SELECT * FROM teams WHERE team_id = ?`,[team_id]);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]));
    return obj;
  });
}