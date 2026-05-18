import { db, persist } from './db.js';

export function insertECUFrame(frame) {
  db.run(
    `INSERT INTO ecu_data
      (ecu_serial, timestamp, voltage_samples, current_samples, power_samples, avg_voltage, avg_current, avg_power, avg_energy, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      frame.ecu_serial,
      frame.timestamp,
      JSON.stringify(frame.voltage_samples),
      frame.current_samples ? JSON.stringify(frame.current_samples) : null,
      frame.power_samples   ? JSON.stringify(frame.power_samples)   : null,
      frame.avg_voltage,
      frame.avg_current ?? null,
      frame.avg_power   ?? null,
      frame.avg_energy  ?? null,
      new Date().toISOString(),
    ]
  );
  persist();
}

export function getAllECUFrames(limit = 1000) {
  const result = db.exec(
    `SELECT ecu_serial, timestamp, avg_voltage, avg_current, avg_power, avg_energy
     FROM ecu_data ORDER BY id DESC LIMIT ?`,
    [limit]
  );
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values
    .map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])))
    .reverse(); // oldest first
}

export function getUniqueECUSerials() {
  const result = db.exec('SELECT DISTINCT ecu_serial FROM ecu_data ORDER BY ecu_serial ASC');
  if (result.length === 0) return [];
  return result[0].values.map(row => row[0]);
}
