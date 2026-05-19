// ecuModel — shape and DDL for the ecu_data table

export const ecuSchema = {
  id:              'INTEGER PRIMARY KEY AUTOINCREMENT',
  ecu_serial:      'INTEGER NOT NULL',
  timestamp:       'TEXT NOT NULL',
  voltage_samples: 'TEXT NOT NULL',   // JSON array of 10 raw ADC readings in millivolts
  current_samples: 'TEXT',            // JSON array of 10 raw ADC readings in milliamps
  power_samples:   'TEXT',            // JSON array of 10 power readings in watts (calculated by ESP32)
  avg_voltage:     'REAL NOT NULL',   // scaled voltage: V_real = raw_mv / 1000
  avg_current:     'REAL',
  avg_power:       'REAL',            // average of power_samples in watts
  avg_energy:      'REAL',            // cumulative energy in watt-hours
  penalty:         'INTEGER DEFAULT 0',
  recorded_at:     'TEXT NOT NULL',   // server-side ISO timestamp
};

export const ecuDDL = `
  CREATE TABLE IF NOT EXISTS ecu_data (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ecu_serial      INTEGER NOT NULL,
    timestamp       TEXT NOT NULL,
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
