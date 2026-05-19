import { processECUFrame, getECUHistory, getECUSerials as fetchSerials } from '../services/ecuService.js';
import { broadcast } from '../../websocket.js';

export function receiveECUData(req, res) {
  console.log('[ECU] incoming request from', req.ip, req.method, req.originalUrl);
  console.log('[ECU] payload:', JSON.stringify(req.body, null, 2));
  const payload = req.body;

  if (!payload.ecu_serial || !payload.timestamp || !Array.isArray(payload.voltage_samples) || !Array.isArray(payload.current_samples)) {
    return res.status(400).json({ error: 'Missing required fields: ecu_serial, timestamp, voltage_samples, current_samples' });
  }

  if (payload.voltage_samples.length !== 10 || payload.current_samples.length !== 10) {
    return res.status(400).json({ error: 'voltage_samples and current_samples must each contain exactly 10 readings' });
  }

  const frame = processECUFrame(payload);
  broadcast({ type: 'ecu_frame', data: frame });
  res.json({ received: true, frame });
}

export function getECUData(req, res) {
  const { ecu_serial, from, limit } = req.query;
  const rows = getECUHistory({
    ecu_serial: ecu_serial ? parseInt(ecu_serial) : undefined,
    from:       from       || undefined,
    limit:      limit      ? parseInt(limit)      : undefined,
  });
  res.json({ count: rows.length, data: rows });
}

export function getECUSerials(req, res) {
  const serials = fetchSerials();
  res.json({ serials });
}