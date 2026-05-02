import { getAlerts as dbGetAlerts } from '../database/alertDb.js';

export function getAlerts({ ecu_serial, competition_id, limit = 100 } = {}) {
  return dbGetAlerts({ ecu_serial, competition_id, limit });
}
