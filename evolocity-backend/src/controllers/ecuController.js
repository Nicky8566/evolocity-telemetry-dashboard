import { processECUFrame, getECUHistory, getECUSerials as fetchSerials } from '../services/ecuService.js';
import { broadcast } from '../../websocket.js';

export function receiveECUData(req, res) {
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
  const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
  const rows = getECUHistory(limit);
  res.json({ count: rows.length, data: rows });
}

export function getECUSerials(req, res) {
  const serials = fetchSerials();
  res.json({ serials });
}