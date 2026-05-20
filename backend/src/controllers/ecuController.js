import { processECUFrame, getECUHistory, getECUSerials as fetchSerials } from '../services/ecuService.js';
import { getECUStatusData, deleteECUBySerial } from '../database/ecuDb.js';
import { broadcast } from '../../websocket.js';

export function receiveECUData(req, res) {
  console.log('[ECU] incoming request from', req.ip, req.method, req.originalUrl);
  console.log('[ECU] payload:', JSON.stringify(req.body, null, 2));
  const payload = req.body;

  if (!payload.ecu_serial || !payload.timestamp || !Array.isArray(payload.voltage_samples) || !Array.isArray(payload.current_samples) || typeof payload.avg_power !== 'number') {
    return res.status(400).json({ error: 'Missing required fields: ecu_serial, timestamp, voltage_samples, current_samples, avg_power' });
  }

  if (payload.voltage_samples.length !== 10 || payload.current_samples.length !== 10) {
    return res.status(400).json({ error: 'voltage_samples and current_samples must each contain exactly 10 readings' });
  }

  if (!Number.isFinite(payload.avg_power)) {
    return res.status(400).json({ error: 'avg_power must be a finite number' });
  }

  if (payload.power_samples != null && (!Array.isArray(payload.power_samples) || payload.power_samples.length !== 10)) {
    return res.status(400).json({ error: 'power_samples must contain exactly 10 readings when provided' });
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

export function getECUStatus(req, res) {
  const devices = getECUStatusData();
  res.json({ devices });
}

export function deleteECU(req, res) {
  const serial = parseInt(req.params.serial);
  if (isNaN(serial)) return res.status(400).json({ error: 'Invalid ECU serial' });
  deleteECUBySerial(serial);
  res.json({ message: `ESP-${serial} and all its data deleted` });
}
