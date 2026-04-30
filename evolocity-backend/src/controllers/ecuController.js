import { processECUFrame, getECUHistory } from '../services/ecuService.js';
import { broadcast } from '../../websocket.js';

export function receiveECUData(req, res) {
  console.log('Headers:', req.headers);
  console.log('Body:', req.body); 
  const payload = req.body;

  // Simulator sends: ecu_serial, timestamp, voltage_samples (need to check naming convetions)
  if (!payload.ecu_serial || !payload.timestamp || !Array.isArray(payload.voltage_samples) || !Array.isArray(payload.current_samples)) {
    return res.status(400).json({ error: 'Missing required fields: ecu_serial, timestamp, voltage_samples, current_samples' });
  }

  if (payload.voltage_samples.length !== 10 || payload.current_samples.length !== 10) {
    return res.status(400).json({ error: 'voltage_samples or current_samples must contain exactly 10 readings' });
  }

  // Process, scale, and store
  const frame = processECUFrame(payload);

  // Broadcast to all connected frontends via WebSocket
  broadcast({
    type: 'ecu_frame',
    data: frame
  });

  res.json({ received: true, frame });
}

export function getECUData(req, res) {
  const rows = getECUHistory();
  res.json({ count: rows.length, data: rows });
}

export function getECUSerials(req, res) {
  const rows = getECUHistory();
  console.log('getECUSerials: Found', rows.length, 'ECU frames');
  // Extract unique ECU serials
  const serials = [...new Set(rows.map(row => row.ecu_serial))].sort((a, b) => a - b);
  console.log('getECUSerials: Unique serials:', serials);
  res.json({ serials });
}