import { db, persist } from './db.js';

export function insertAlert(alert) {
  db.run(
    `INSERT INTO alerts (ecu_serial, power_value, threshold, started_at, type)
     VALUES (?, ?, ?, ?, ?)`,
    [alert.ecu_serial, alert.power_value, alert.threshold, alert.started_at, alert.type ?? 'warning']
  );
  const result = db.exec('SELECT last_insert_rowid() AS id');
  const id = result[0].values[0][0];
  persist();
  return id;
}

export function updateAlertType(id, type) {
  db.run('UPDATE alerts SET type = ? WHERE id = ?', [type, id]);
  persist();
}

export function updateAlertEnd(id, power_value, ended_at, duration_ms) {
  db.run(
    'UPDATE alerts SET power_value = ?, ended_at = ?, duration_ms = ? WHERE id = ?',
    [power_value, ended_at, duration_ms, id]
  );
  persist();
}

export function getAlertById(id) {
  const result = db.exec('SELECT * FROM alerts WHERE id = ?', [id]);
  if (result.length === 0) return null;
  const { columns, values } = result[0];
  return Object.fromEntries(columns.map((col, i) => [col, values[0][i]]));
}

export function getAlerts({ ecu_serial, competition_id, limit = 100 } = {}) {
  let query, params;

  if (competition_id) {
    query = `
      SELECT DISTINCT a.* FROM alerts a
      JOIN teams t ON t.ecu_serial = a.ecu_serial
      JOIN competition_teams ct ON ct.team_id = t.id
      WHERE ct.competition_id = ?
      ${ecu_serial ? 'AND a.ecu_serial = ?' : ''}
      ORDER BY a.id DESC LIMIT ?
    `;
    params = ecu_serial ? [competition_id, ecu_serial, limit] : [competition_id, limit];
  } else {
    query = `
      SELECT * FROM alerts
      ${ecu_serial ? 'WHERE ecu_serial = ?' : ''}
      ORDER BY id DESC LIMIT ?
    `;
    params = ecu_serial ? [ecu_serial, limit] : [limit];
  }

  const result = db.exec(query, params);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}
