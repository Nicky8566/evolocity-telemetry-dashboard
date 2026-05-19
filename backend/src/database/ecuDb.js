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

export function getAllECUFrames({ ecu_serial, from, limit } = {}) {
  const conditions = [];
  const params     = [];

  if (ecu_serial != null) { conditions.push('ecu_serial = ?'); params.push(ecu_serial); }
  if (from)               { conditions.push('recorded_at >= ?'); params.push(from); }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitSql = limit != null ? `LIMIT ${parseInt(limit)}` : '';

  const result = db.exec(
    `SELECT ecu_serial, timestamp, avg_voltage, avg_current, avg_power, avg_energy
     FROM ecu_data ${where} ORDER BY id ASC ${limitSql}`,
    params
  );
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

export function getUniqueECUSerials() {
  const result = db.exec('SELECT DISTINCT ecu_serial FROM ecu_data ORDER BY ecu_serial ASC');
  if (result.length === 0) return [];
  return result[0].values.map(row => row[0]);
}

export function deleteECUBySerial(ecu_serial) {
  db.run('UPDATE teams SET ecu_serial = NULL WHERE ecu_serial = ?', [ecu_serial]);
  db.run('DELETE FROM ecu_data WHERE ecu_serial = ?', [ecu_serial]);
  persist();
}

export function getECUStatusData() {
  const result = db.exec(`
    SELECT ecu_serial, MAX(recorded_at) AS last_recorded_at, COUNT(*) AS total_frames
    FROM ecu_data
    GROUP BY ecu_serial
    ORDER BY ecu_serial ASC
  `);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}
