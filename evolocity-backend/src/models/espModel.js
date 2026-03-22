// ESPModel — defines the structure of ESP32 ECU data stored in the database
// This is the equivalent of a Mongoose schema for our SQLite setup

export const ESP_TABLE = 'ecu_data';

// Shape of an ECU data record (for reference and validation)
export const ECUSchema = {
  // Configuration
  serial_number: 'INTEGER',   // unique identifier for each ECU
  team_number: 'INTEGER',     // team this ECU belongs to
  vehicle_class: 'TEXT',      // 'standard' (350W) or 'open' (2kW)
  vehicle_type: 'TEXT',       // 'bike' or 'kart'

  // Energy Frame
  timestamp: 'TEXT',          // when this frame was recorded
  avg_voltage: 'REAL',        // average voltage (up to 60V)
  avg_current: 'REAL',        // average current (bi-directional, up to 100A)
  energy: 'REAL',             // energy since last frame (Wh)

  // Status
  flash_usage: 'INTEGER',     // flash memory usage
  internal_temp: 'REAL',      // internal temperature of ECU

  // Penalty flag
  penalty: 'INTEGER',         // 0 = no penalty, 1 = exceeded power limit
  recorded_at: 'TEXT',        // when server received this record
};

// Creates the table in SQLite if it doesn't exist
export function createECUTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS ${ESP_TABLE} (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      serial_number  INTEGER NOT NULL,
      team_number    INTEGER NOT NULL,
      vehicle_class  TEXT CHECK(vehicle_class IN ('standard', 'open')) NOT NULL,
      vehicle_type   TEXT CHECK(vehicle_type IN ('bike', 'kart')) NOT NULL,
      timestamp      TEXT NOT NULL,
      avg_voltage    REAL NOT NULL,
      avg_current    REAL NOT NULL,
      energy         REAL NOT NULL,
      flash_usage    INTEGER,
      internal_temp  REAL,
      penalty        INTEGER DEFAULT 0,
      recorded_at    TEXT NOT NULL
    )
  `);
}