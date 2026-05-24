import { insertECUFrame, getAllECUFrames, getUniqueECUSerials } from '../database/ecuDb.js';
import { getTeamByEcu } from '../database/teamDb.js';
import { insertAlert, updateAlertType, updateAlertEnd, getAlertById } from '../database/alertDb.js';
import { getActiveRunForEcu } from '../database/runDb.js';
import { applyPenalty } from './penaltyService.js';
import { broadcastAlert } from '../../websocket.js';

// ecu_serial → { alertId, startedAt, startedMs, peakPower, escalated }
const activeBreaches = new Map();
const activeCurrentBreaches = new Map();

// Frames arrive at 10Hz — each covers 0.1s
const FRAME_DURATION_HOURS = 0.1 / 3600;

// Breach held for >= 1s (in device time) escalates from warning → penalty
const PENALTY_THRESHOLD_MS = 1000;

// ─── Scaling helpers ──────────────────────────────────────────────────────────
// Real ESP32 firmware sends integer sensor readings:
//   voltage_samples : integer mV  (ADC * VOLTAGE_GAIN)
//   current_samples : integer mA  (mv_to_current_ma())
//   power_samples   : integer mW  ((voltage_mv * current_ma) / 1000, integer division)
function scaleVoltage(mv)  { return mv  / 1000; }  // mV  → V
function scaleCurrent(ma)  { return ma  / 1000; }  // mA  → A
function scalePower(mw)    { return mw  / 1000; }  // mW  → W

// ─── Session tracking ─────────────────────────────────────────────────────────
// When an ESP32 reboots its uptime counter resets to 0, causing timestamp_ms
// values that duplicate the previous session.  We detect this by watching for
// a fresh uptime (< 10 s) after significant prior runtime (> 30 s) and increment
// the boot_session counter.  The physical ecu_serial never changes — boot_session
// is a separate field so team→device mappings remain intact across reboots and
// the frontend can display "ESP-2 (1)" instead of a confusing large serial number.
//
// Dump frames sent on reconnection have large uptime values so they will NEVER
// trigger this check — only a genuine near-zero uptime does.
//
// physical_serial → { lastUptime, bootCount }
const deviceSessions = new Map();

function getBootSession(physical_serial, uptime_ms) {
  if (!deviceSessions.has(physical_serial)) {
    deviceSessions.set(physical_serial, { lastUptime: uptime_ms, bootCount: 0 });
    return 0;
  }

  const session = deviceSessions.get(physical_serial);

  if (uptime_ms < 10_000 && session.lastUptime > 30_000) {
    session.bootCount++;
    console.log(
      `[ECU ${physical_serial}] Reboot #${session.bootCount} detected ` +
      `(uptime ${uptime_ms} ms after ${session.lastUptime} ms)`
    );
  }

  session.lastUptime = uptime_ms;
  return session.bootCount;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPowerLimit(ecu_serial) {
  const teams = getTeamByEcu(ecu_serial);
  if (teams.length === 0) return 2000;
  if (teams[0].power_limit != null) return teams[0].power_limit;
  return teams[0].vehicle_class?.toLowerCase() === 'standard' ? 350 : 2000;
}

export function getCurrentLimit(ecu_serial) {
  const teams = getTeamByEcu(ecu_serial);
  if (teams.length === 0) return 100;
  if (teams[0].current_limit != null) return teams[0].current_limit;
  return 100;
}

function computeAverages(payload) {
  const { voltage_samples, current_samples, power_samples } = payload;

  const scaled_voltage = voltage_samples.map(scaleVoltage);
  const avg_voltage    = scaled_voltage.reduce((s, v) => s + v, 0) / scaled_voltage.length;

  const scaled_current = current_samples.map(scaleCurrent);
  const avg_current    = scaled_current.reduce((s, v) => s + v, 0) / scaled_current.length;

  // Scale mW → W if the firmware provided power samples; otherwise derive from V * A
  const scaled_power = power_samples ? power_samples.map(scalePower) : null;
  const avg_power    = scaled_power
    ? scaled_power.reduce((s, p) => s + p, 0) / scaled_power.length
    : avg_voltage * avg_current;

  const avg_energy = avg_power * FRAME_DURATION_HOURS;

  return { scaled_voltage, scaled_current, scaled_power, avg_voltage, avg_current, avg_power, avg_energy };
}

// timestamp_ms = device uptime ms — used for duration accuracy across reconnection dumps
// received_at_ms = server epoch ms — used for alert ISO timestamps and live detection
function checkBreach(ecu_serial, avg_power, avg_current, timestamp_ms, received_at_ms) {
  const powerLimit   = getPowerLimit(ecu_serial);
  const currentLimit = getCurrentLimit(ecu_serial);
  const overLimit    = avg_power >= powerLimit;
  const overCurrentLimit = avg_current >= currentLimit;
  const wasBreaching = activeBreaches.has(ecu_serial);
  const wasCurrentBreaching = activeCurrentBreaches.has(ecu_serial);

  if (overLimit && !wasBreaching) {
    const startedAt = new Date(received_at_ms).toISOString();
    const alertId   = insertAlert({ ecu_serial, power_value: avg_power, threshold: powerLimit, started_at: startedAt, type: 'warning' });
    activeBreaches.set(ecu_serial, { alertId, startedAt, startedMs: timestamp_ms, peakPower: avg_power, escalated: false });
    broadcastAlert({ type: 'alert', data: getAlertById(alertId) });

  } else if (overLimit && wasBreaching) {
    const breach = activeBreaches.get(ecu_serial);
    if (avg_power > breach.peakPower) breach.peakPower = avg_power;
    if (!breach.escalated && timestamp_ms - breach.startedMs >= PENALTY_THRESHOLD_MS) {
      breach.escalated = true;
      updateAlertType(breach.alertId, 'penalty');
      broadcastAlert({ type: 'alert', data: getAlertById(breach.alertId) });
    }

  } else if (!overLimit && wasBreaching) {
    const breach     = activeBreaches.get(ecu_serial);
    const endedAt    = new Date(received_at_ms).toISOString();
    const durationMs = timestamp_ms - breach.startedMs;
    updateAlertEnd(breach.alertId, breach.peakPower, endedAt, durationMs);
    activeBreaches.delete(ecu_serial);
    broadcastAlert({ type: 'alert', data: getAlertById(breach.alertId) });

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

  if (overCurrentLimit && !wasCurrentBreaching) {
    const startedAt = new Date(received_at_ms).toISOString();
    const alertId   = insertAlert({ ecu_serial, power_value: avg_current, threshold: currentLimit, started_at: startedAt, metric: 'current', type: 'warning' });
    activeCurrentBreaches.set(ecu_serial, { alertId, startedAt, startedMs: timestamp_ms, peakCurrent: avg_current });
    broadcastAlert({ type: 'alert', data: getAlertById(alertId) });

  } else if (overCurrentLimit && wasCurrentBreaching) {
    const breach = activeCurrentBreaches.get(ecu_serial);
    if (avg_current > breach.peakCurrent) breach.peakCurrent = avg_current;

  } else if (!overCurrentLimit && wasCurrentBreaching) {
    const breach     = activeCurrentBreaches.get(ecu_serial);
    const endedAt    = new Date(received_at_ms).toISOString();
    const durationMs = timestamp_ms - breach.startedMs;
    updateAlertEnd(breach.alertId, breach.peakCurrent, endedAt, durationMs);
    activeCurrentBreaches.delete(ecu_serial);
    broadcastAlert({ type: 'alert', data: getAlertById(breach.alertId) });
  }
}

function buildFrame(ecu_serial, boot_session, payload, timestamp, timestamp_ms, uptime_ms, received_at_ms) {
  const { scaled_voltage, scaled_current, scaled_power, avg_voltage, avg_current, avg_power, avg_energy } = computeAverages(payload);

  checkBreach(ecu_serial, avg_power, avg_current, timestamp_ms, received_at_ms);

  insertECUFrame({
    ecu_serial,
    boot_session,
    timestamp,
    uptime_ms:       uptime_ms ?? null,
    voltage_samples: scaled_voltage,           // stored in V
    current_samples: scaled_current,           // stored in A
    power_samples:   scaled_power,             // stored in W (mW → W); null if not provided
    avg_voltage,
    avg_current,
    avg_power,
    avg_energy,
  });

  return { ecu_serial, boot_session, timestamp, timestamp_ms, uptime_ms: uptime_ms ?? null, received_at_ms, avg_voltage, avg_current, avg_power, avg_energy };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function processECUFrame(payload) {
  const { ecu_serial } = payload;
  const received_at_ms = Date.now();

  if (typeof payload.timestamp === 'number') {
    const uptime_ms    = payload.timestamp;
    const boot_session = getBootSession(ecu_serial, uptime_ms);
    const timestamp    = new Date(received_at_ms).toISOString(); // server receipt for exports
    return [buildFrame(ecu_serial, boot_session, payload, timestamp, uptime_ms, uptime_ms, received_at_ms)];
  }

  // Simulator / NTP device — ISO string timestamp, always boot_session 0
  const timestamp    = payload.timestamp;
  const timestamp_ms = new Date(timestamp).getTime();
  return [buildFrame(ecu_serial, 0, payload, timestamp, timestamp_ms, null, received_at_ms)];
}

export function getECUHistory({ ecu_serial, boot_session, from, limit } = {}) {
  return getAllECUFrames({ ecu_serial, boot_session, from, limit });
}

export function getECUSerials() {
  return getUniqueECUSerials();
}