import { getAlerts } from '../services/alertService.js';

export function getAlertsHandler(req, res) {
  const { ecu_serial, competition_id, limit } = req.query;
  const alerts = getAlerts({
    ecu_serial: ecu_serial ? parseInt(ecu_serial) : undefined,
    competition_id: competition_id ? parseInt(competition_id) : undefined,
    limit: limit ? parseInt(limit) : 100,
  });
  res.json({ count: alerts.length, data: alerts });
}
