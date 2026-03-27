import { insertECUFrame, getAllECUFrames } from '../database/db.js';

// Scaling formula from electrical team 
// V_real = 22.3 * V_sens  (V_sens in volts, so divide millivolts by 1000)
function scaleVoltage(millivolts) {
  const V_sens = millivolts / 1000;   // convert mV → V
  return 22.3 * V_sens;               // scale up to real voltage
}

export function processECUFrame(payload) {
  const { ecu_serial, timestamp, voltage_samples } = payload;

  // Average the 10 raw millivolt readings
  const avgRawMv = voltage_samples.reduce((sum, v) => sum + v, 0) / voltage_samples.length;

  // Scale to real voltage using  formula
  const avg_voltage = scaleVoltage(avgRawMv);

  // Current not yet sent by ESP32 — placeholder for when compsys adds it
  const avg_current = payload.current_mv != null
    ? (payload.current_mv / 1000 - 1.65) / 0.01037
    : null;

  // Penalty check — open class limit is 2000W
  const power = avg_current != null ? avg_voltage * avg_current : null;
  const penalty = power != null && power > 2000;

  const frame = {
    ecu_serial,
    timestamp,
    voltage_samples,
    avg_voltage,
    avg_current,
    penalty
  };

  insertECUFrame(frame);
  return frame;
}

export function getECUHistory() {
  return getAllECUFrames();
}