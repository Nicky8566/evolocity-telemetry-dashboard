import { insertRun, finaliseRun, getRunById, listRuns, nextAttemptNumber, getActiveRun } from '../database/runDb.js';
import { getTeamById } from '../database/teamDb.js';
import { getCompetitionById } from '../database/competitionDb.js';
import { db } from '../database/db.js';
import { EVENT_TYPES } from '../models/competitionModel.js';
import { RUN_OUTCOMES as VALID_OUTCOMES } from '../models/runModel.js';
import { broadcastAlert } from '../../websocket.js';

function competitionHasEvent(competition_id, event_type) {
  const result = db.exec(
    `SELECT 1 FROM competition_events WHERE competition_id = ? AND event_type = ?`,
    [competition_id, event_type]
  );
  if (result.length > 0 && result[0].values.length > 0) return true;
  // Back-compat: legacy comps may only have competitions.event_type populated.
  const fallback = db.exec(
    `SELECT 1 FROM competitions WHERE id = ? AND event_type = ?`,
    [competition_id, event_type]
  );
  return fallback.length > 0 && fallback[0].values.length > 0;
}

export function startRun({ team_id, competition_id, event_type }) {
  if (!team_id || !competition_id || !event_type) {
    return { error: 'team_id, competition_id, and event_type are required' };
  }
  if (!EVENT_TYPES.includes(event_type)) {
    return { error: `event_type must be one of: ${EVENT_TYPES.join(', ')}` };
  }
  if (!getTeamById(team_id)) return { error: 'Team not found' };
  if (!getCompetitionById(competition_id)) return { error: 'Competition not found' };
  if (!competitionHasEvent(competition_id, event_type)) {
    return { error: `Competition does not include event_type '${event_type}'` };
  }
  if (getActiveRun(team_id, event_type)) {
    return { error: 'Team already has an active run for this event' };
  }

  const attempt_number = nextAttemptNumber(team_id, competition_id, event_type);
  const started_at = new Date().toISOString();
  const id = insertRun({ team_id, competition_id, event_type, attempt_number, started_at });
  const run = getRunById(id);
  broadcastAlert({ type: 'run', data: run });
  return run;
}

function computeEfficiencyEnergy(team_id, started_at, ended_at) {
  const teamResult = db.exec('SELECT ecu_serial FROM teams WHERE id = ?', [team_id]);
  if (teamResult.length === 0 || teamResult[0].values.length === 0) return 0;
  const ecu_serial = teamResult[0].values[0][0];
  if (ecu_serial == null) return 0;

  const result = db.exec(
    `SELECT COALESCE(SUM(avg_energy), 0) AS total_wh
     FROM ecu_data
     WHERE ecu_serial = ? AND recorded_at >= ? AND recorded_at <= ?`,
    [ecu_serial, started_at, ended_at]
  );
  return result[0]?.values[0]?.[0] ?? 0;
}

export function stopRun(id, { outcome = 'finished' } = {}) {
  if (!VALID_OUTCOMES.includes(outcome) || outcome === 'running') {
    return { error: `outcome must be one of: ${VALID_OUTCOMES.filter(o => o !== 'running').join(', ')}` };
  }
  const run = getRunById(id);
  if (!run) return { error: 'Run not found' };
  if (run.outcome !== 'running') return { error: 'Run is already finalised' };

  const ended_at = new Date().toISOString();

  let raw_metric = null;
  let raw_metric_unit = null;
  if (outcome === 'finished') {
    if (run.event_type === 'efficiency') {
      raw_metric = computeEfficiencyEnergy(run.team_id, run.started_at, ended_at);
      raw_metric_unit = 'wh';
    } else {
      raw_metric = (new Date(ended_at).getTime() - new Date(run.started_at).getTime()) / 1000;
      raw_metric_unit = 'seconds';
    }
  }

  finaliseRun(id, { ended_at, outcome, raw_metric, raw_metric_unit });
  const finalRun = getRunById(id);
  broadcastAlert({ type: 'run', data: finalRun });
  // Nudge any leaderboard listeners — full results are fetched via HTTP.
  broadcastAlert({ type: 'leaderboard', data: { competition_id: finalRun.competition_id } });
  return finalRun;
}

export function getRuns(params) {
  return listRuns(params);
}

export function getRun(id) {
  return getRunById(id);
}
