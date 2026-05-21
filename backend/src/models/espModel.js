// ecuModel — shape and DDL for the ecu_data table

export const ecuSchema = {
  id:              'INTEGER PRIMARY KEY AUTOINCREMENT',
  ecu_serial:      'INTEGER NOT NULL',
  timestamp:       'TEXT NOT NULL',    // server receipt ISO string (for exports/ordering)
  boot_session:    'INTEGER NOT NULL DEFAULT 0', // increments on each detected reboot; 0 = first boot
  uptime_ms:       'INTEGER',          // raw device uptime counter (null for simulator/NTP frames)
  voltage_samples: 'TEXT NOT NULL',    // JSON array of 10 scaled voltage readings in volts
  current_samples: 'TEXT',             // JSON array of 10 scaled current readings in amps
  power_samples:   'TEXT',             // optional JSON array of 10 power readings in watts from ESP32
  avg_voltage:     'REAL NOT NULL',
  avg_current:     'REAL',
  avg_power:       'REAL',
  avg_energy:      'REAL',             // watt-hours for this 0.1s frame
  penalty:         'INTEGER DEFAULT 0',
  recorded_at:     'TEXT NOT NULL',    // server-side receipt time (for diagnostics)
};

export const ecuDDL = `
  CREATE TABLE IF NOT EXISTS ecu_data (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ecu_serial      INTEGER NOT NULL,
    timestamp       TEXT NOT NULL,
    boot_session    INTEGER NOT NULL DEFAULT 0,
    uptime_ms       INTEGER,
    voltage_samples TEXT NOT NULL,
    current_samples TEXT,
    power_samples   TEXT,
    avg_voltage     REAL NOT NULL,
    avg_current     REAL,
    avg_power       REAL,
    avg_energy      REAL,
    penalty         INTEGER DEFAULT 0,
    recorded_at     TEXT NOT NULL
  )
`;
