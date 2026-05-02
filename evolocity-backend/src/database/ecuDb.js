import { db, persist } from './db.js';

export function insertECUFrame(frame) {
  db.run(
    `INSERT INTO ecu_data
      (ecu_serial, timestamp, voltage_samples, current_samples, avg_voltage, avg_current, penalty, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      frame.ecu_serial,
      frame.timestamp,
      JSON.stringify(frame.voltage_samples),
      frame.current_samples ? JSON.stringify(frame.current_samples) : null,
      frame.avg_voltage,
      frame.avg_current ?? null,
      frame.penalty ? 1 : 0,
      new Date().toISOString()
    ]
  );
  persist();
}

// Capped at 1000 rows by default — was previously fetching entire table
export function getAllECUFrames(limit = 1000) {
  const result = db.exec(
    `SELECT * FROM ecu_data ORDER BY id DESC LIMIT ?`,
    [limit]
  );
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]));
    obj.voltage_samples = JSON.parse(obj.voltage_samples);
    obj.current_samples = obj.current_samples ? JSON.parse(obj.current_samples) : null;
    return obj;
  }).reverse(); // reverse so oldest first after DESC fetch
}

export function getUniqueECUSerials() {
  const result = db.exec('SELECT DISTINCT ecu_serial FROM ecu_data ORDER BY ecu_serial ASC');
  if (result.length === 0) return [];
  return result[0].values.map(row => row[0]);
}