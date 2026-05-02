import { insertECUFrame, getAllECUFrames, getUniqueECUSerials } from '../database/Ecudb.js';
import { getTeamByEcu } from '../database/Teamdb.js';

// Scaling formula from electrical team
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