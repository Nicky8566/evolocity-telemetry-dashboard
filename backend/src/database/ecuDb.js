import { db, persist } from './db.js';

export function insertECUFrame(frame) {
  db.run(
    `INSERT INTO ecu_data
      (ecu_serial, timestamp, boot_session, uptime_ms, voltage_samples, current_samples, power_samples, avg_voltage, avg_current, avg_power, avg_energy, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      frame.ecu_serial,
      frame.timestamp,
      frame.boot_session ?? 0,
      frame.uptime_ms ?? null,
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

export function getAllECUFrames({ ecu_serial, boot_session, from, limit } = {}) {
  const conditions = [];
  const params     = [];

  if (ecu_serial  != null) { conditions.push('ecu_serial = ?');   params.push(ecu_serial); }
  if (boot_session != null) { conditions.push('boot_session = ?'); params.push(boot_session); }
  if (from)                 { conditions.push('timestamp >= ?');   params.push(from); }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitSql = limit != null ? `LIMIT ${parseInt(limit)}` : '';

  // Order by device uptime when available so dump frames (buffered during
  // offline, arriving in a burst on reconnect) sort into their correct
  // chronological position rather than interleaving with live frames by
  // server-receipt time.  Simulator frames (null uptime_ms) fall back to
  // insertion order via id.
  const result = db.exec(
    `SELECT ecu_serial, boot_session, timestamp, uptime_ms, avg_voltage, avg_current, avg_power, avg_energy
     FROM ecu_data ${where} ORDER BY boot_session ASC, COALESCE(uptime_ms, id) ASC ${limitSql}`,
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
