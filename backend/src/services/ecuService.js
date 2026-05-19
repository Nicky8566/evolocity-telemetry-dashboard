import { insertECUFrame, getAllECUFrames, getUniqueECUSerials } from '../database/ecuDb.js';
import { getTeamByEcu } from '../database/teamDb.js';
import { insertAlert, updateAlertType, updateAlertEnd, getAlertById } from '../database/alertDb.js';
import { getActiveRunForEcu } from '../database/runDb.js';
import { applyPenalty } from './penaltyService.js';
import { broadcastAlert } from '../../websocket.js';

// ecu_serial → { alertId, startedAt, peakPower, escalated }
const activeBreaches = new Map();

// Frames arrive at 10Hz — each covers 0.1s
const FRAME_DURATION_HOURS = 0.1 / 3600;

// Breach held for >= 1s escalates from warning → penalty
const PENALTY_THRESHOLD_MS = 1000;

function scaleVoltage(millivolts) {
  return (millivolts / 1000);
}

function scaleCurrent(current) {
  return (current / 1000);
}

function getPowerLimit(ecu_serial) {
  const teams = getTeamByEcu(ecu_serial);
  if (teams.length === 0) return 2000;
  if (teams[0].power_limit != null) return teams[0].power_limit;
  return teams[0].vehicle_class?.toLowerCase() === 'standard' ? 350 : 2000;
}

export function processECUFrame(payload) {
  const { ecu_serial, timestamp, voltage_samples, current_samples, power_samples } = payload;

  const scaled_voltage = voltage_samples.map(scaleVoltage);
  const avg_voltage    = scaled_voltage.reduce((s, v) => s + v, 0) / scaled_voltage.length;
  const scaled_current = current_samples.map(scaleCurrent);
  const avg_current    = scaled_current.reduce((s, v) => s + v, 0) / scaled_current.length;
  const avg_power      = power_samples
    ? power_samples.reduce((s, p) => s + p, 0) / power_samples.length
    : avg_voltage * avg_current;
  const avg_energy     = avg_power * FRAME_DURATION_HOURS; // Wh delta for this frame

  const powerLimit   = getPowerLimit(ecu_serial);
  const overLimit    = avg_power >= powerLimit;
  const wasBreaching = activeBreaches.has(ecu_serial);

  if (overLimit && !wasBreaching) {
    // Breach just started — open as warning
    const startedAt = new Date().toISOString();
    const alertId   = insertAlert({ ecu_serial, power_value: avg_power, threshold: powerLimit, started_at: startedAt, type: 'warning' });
    activeBreaches.set(ecu_serial, { alertId, startedAt, peakPower: avg_power, escalated: false });
    broadcastAlert({ type: 'alert', data: getAlertById(alertId) });

  } else if (overLimit && wasBreaching) {
    const breach    = activeBreaches.get(ecu_serial);
    if (avg_power > breach.peakPower) breach.peakPower = avg_power;

    // Escalate to penalty once breach has held for >= 1s
    if (!breach.escalated && Date.now() - new Date(breach.startedAt).getTime() >= PENALTY_THRESHOLD_MS) {
      breach.escalated = true;
      updateAlertType(breach.alertId, 'penalty');
      broadcastAlert({ type: 'alert', data: getAlertById(breach.alertId) });
    }

  } else if (!overLimit && wasBreaching) {
    // Breach ended — close the row
    const breach     = activeBreaches.get(ecu_serial);
    const endedAt    = new Date().toISOString();
    const durationMs = new Date(endedAt) - new Date(breach.startedAt);
    updateAlertEnd(breach.alertId, breach.peakPower, endedAt, durationMs);
    activeBreaches.delete(ecu_serial);
    broadcastAlert({ type: 'alert', data: getAlertById(breach.alertId) });

    // Rules RE.5.1.b: 5s base + 5s/sec in the Power Limiter's Penalty Zone.
    // CR.3.4 says breaches <1s aren't penalised; that lines up with floor(ms/1000) being 0.
    const penaltySeconds = 5 * Math.floor(durationMs / 1000);
    if (penaltySeconds > 0) {
      const run = getActiveRunForEcu(ecu_serial, 'efficiency');
      if (run) {
        applyPenalty({
          run_id:       run.id,
          penalty_type: 'power_zone',
          value:        penaltySeconds,
          unit:         'seconds',
          source:       'auto',
          note:         `Auto: ${(durationMs / 1000).toFixed(2)}s in penalty zone, peak ${breach.peakPower.toFixed(0)}W`,
        });
      }
    }
  }

  const frame = {
    ecu_serial,
    timestamp,
    voltage_samples: scaled_voltage,
    current_samples,
    power_samples: power_samples ?? null,
    avg_voltage,
    avg_current,
    avg_power,
    avg_energy,
  };

  insertECUFrame(frame);

  // Return only the fields the frontend needs
  return { ecu_serial, timestamp, avg_voltage, avg_current, avg_power, avg_energy };
}

export function getECUHistory({ ecu_serial, from, limit } = {}) {
  return getAllECUFrames({ ecu_serial, from, limit });
}

export function getECUSerials() {
  return getUniqueECUSerials();
}
