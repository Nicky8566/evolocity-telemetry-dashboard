import { insertECUFrame, getAllECUFrames, getUniqueECUSerials } from '../database/ecuDb.js';
import { getTeamByEcu } from '../database/teamDb.js';
import { insertAlert, updateAlertEnd, getAlertById } from '../database/alertDb.js';
import { broadcastAlert } from '../../websocket.js';

// Tracks active breaches per ECU: ecu_serial → { alertId, startedAt, peakPower }
const activeBreaches = new Map();

// V_real = 22.3 * V_sens (V_sens in volts, divide millivolts by 1000)
function scaleVoltage(millivolts) {
  const V_sens = millivolts / 1000;
  return 22.3 * V_sens;
}

// Power limit resolution order: custom per-team override → vehicle class default → open class fallback
function getPowerLimit(ecu_serial) {
  const teams = getTeamByEcu(ecu_serial);
  if (teams.length === 0) return 2000;
  if (teams[0].power_limit != null) return teams[0].power_limit;
  const vehicleClass = teams[0].vehicle_class?.toLowerCase();
  return vehicleClass === 'standard' ? 350 : 2000;
}

export function processECUFrame(payload) {
  const { ecu_serial, timestamp, voltage_samples, current_samples } = payload;

  const scaled_voltage_samples = voltage_samples.map(mv => scaleVoltage(mv));
  const avg_voltage = scaled_voltage_samples.reduce((sum, v) => sum + v, 0) / scaled_voltage_samples.length;

  // Current arrives in amps directly — no scaling needed
  const scaled_current_samples = current_samples;
  const avg_current = scaled_current_samples.reduce((sum, v) => sum + v, 0) / scaled_current_samples.length;

  const powerLimit = getPowerLimit(ecu_serial);
  const power = avg_voltage * avg_current;
  const penalty = power > powerLimit;

  // Alert state machine
  const inBreach = activeBreaches.has(ecu_serial);

  if (penalty && !inBreach) {
    // Breach just started — open a new alert row
    const startedAt = new Date().toISOString();
    const alertId = insertAlert({ ecu_serial, power_value: power, threshold: powerLimit, started_at: startedAt });
    activeBreaches.set(ecu_serial, { alertId, startedAt, peakPower: power });
    broadcastAlert({ type: 'alert', data: getAlertById(alertId) });
  } else if (penalty && inBreach) {
    // Still breaching — track peak power for when breach ends
    const breach = activeBreaches.get(ecu_serial);
    if (power > breach.peakPower) breach.peakPower = power;
  } else if (!penalty && inBreach) {
    // Breach just ended — close the alert row with peak power and duration
    const breach = activeBreaches.get(ecu_serial);
    const endedAt = new Date().toISOString();
    const durationMs = new Date(endedAt) - new Date(breach.startedAt);
    updateAlertEnd(breach.alertId, breach.peakPower, endedAt, durationMs);
    activeBreaches.delete(ecu_serial);
    broadcastAlert({ type: 'alert', data: getAlertById(breach.alertId) });
  }

  const frame = {
    ecu_serial,
    timestamp,
    voltage_samples: scaled_voltage_samples,
    current_samples: scaled_current_samples,
    avg_voltage,
    avg_current,
    power,
    power_limit: powerLimit,
    penalty
  };

  insertECUFrame(frame);
  return frame;
}

export function getECUHistory(limit = 1000) {
  return getAllECUFrames(limit);
}

export function getECUSerials() {
  return getUniqueECUSerials();
}
