import { insertECUFrame, getAllECUFrames } from '../database/db.js';

// Scaling formula from electrical team 
// V_real = 22.3 * V_sens  (V_sens in volts, so divide millivolts by 1000)
function scaleVoltage(millivolts) {
  const V_sens = millivolts / 1000;   // convert mV → V
  return 22.3 * V_sens;               // scale up to real voltage
}

// function scaleCurrent(milliamp) {
//   return ((milliamp - 1.65) / 0.01037);  // scale up to real current
// }

export function processECUFrame(payload) {
  const { ecu_serial, timestamp, voltage_samples, current_samples} = payload;

  // Average the 10 raw millivolt readings
  // const avgRawMv = voltage_samples.reduce((sum, v) => sum + v, 0) / voltage_samples.length;
  // const avg_voltage = scaleVoltage(avgRawMv);

  // Scale each sample individually
  const scaled_voltage_samples = voltage_samples.map(mv => scaleVoltage(mv));
  const avg_voltage = scaled_voltage_samples.reduce((sum, v) => sum + v, 0) / scaled_voltage_samples.length; // keep for DB schema compat

 // No scaling needed — current arrives in amps directly
 const scaled_current_samples = current_samples;
 const avg_current = scaled_current_samples.reduce((sum, v) => sum + v, 0) / scaled_current_samples.length;

  // const avg_current = payload.current_mv != null
  //   ? (payload.current_mv / 1000 - 1.65) / 0.01037
  //   : null;

  const power = avg_current != null ? avg_voltage * avg_current : null;
  const penalty = power != null && power > 2000;

  const frame = {
    ecu_serial,
    timestamp,
    voltage_samples: scaled_voltage_samples, // now scaled individually
    current_samples: scaled_current_samples, // now scaled individually
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