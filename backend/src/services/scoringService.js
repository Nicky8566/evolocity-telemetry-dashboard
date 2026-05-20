import { db } from '../database/db.js';
import { listRuns } from '../database/runDb.js';
import { listPenaltiesByRun } from '../database/penaltyDb.js';
import { getTeamById } from '../database/teamDb.js';
import { getCompetitionById } from '../database/competitionDb.js';

// Slides p.22 / Rules Table 6: 100 pts for 1st, 25 pts for last, linear in between.
// DNS/DNF/DQ = 0. This is applied per event, then summed across events for overall.
function placePoints(rank, finisherCount) {
  if (finisherCount <= 0) return 0;
  if (finisherCount === 1) return 100;
  return 100 - (rank - 1) * (75 / (finisherCount - 1));
}

function summarisePenalties(penalties) {
  const secondsTotal = penalties.filter(p => p.unit === 'seconds').reduce((s, p) => s + p.value, 0);
  const pointsTotal  = penalties.filter(p => p.unit === 'points').reduce((s, p) => s + p.value, 0);
  return { secondsTotal, pointsTotal, count: penalties.length };
}

// For an efficiency run, seconds penalties are converted to Wh using the team's power limit:
// extra_wh = penalty_seconds * (power_limit_W) / 3600
function adjustedMetricForRun(run, penalties, team) {
  const { secondsTotal, pointsTotal } = summarisePenalties(penalties);
  if (run.event_type === 'efficiency') {
    const powerLimitW = team.power_limit ?? (team.vehicle_class === 'standard' ? 350 : 2000);
    const adjustedEnergy = (run.raw_metric ?? 0) + (secondsTotal * powerLimitW / 3600);
    return { adjusted: adjustedEnergy, unit: 'wh', secondsTotal, pointsTotal };
  }
  const adjustedTime = (run.raw_metric ?? 0) + secondsTotal;
  return { adjusted: adjustedTime, unit: 'seconds', secondsTotal, pointsTotal };
}

function isDisqualified(outcome) {
  return outcome === 'dnf' || outcome === 'dq' || outcome === 'dns';
}

// For a team in an event, return their best (lowest-adjusted) finished attempt.
// Teams with at least one DNF/DQ/DNS but no finished attempt take that outcome.
function bestAttemptForTeam(runs, team) {
  const finished = runs.filter(r => r.outcome === 'finished' && r.raw_metric != null);
  if (finished.length > 0) {
    const evaluated = finished.map(r => {
      const penalties = listPenaltiesByRun(r.id);
      const adj = adjustedMetricForRun(r, penalties, team);
      return { run: r, penalties, ...adj };
    });
    evaluated.sort((a, b) => a.adjusted - b.adjusted);
    return { ...evaluated[0], outcome: 'finished' };
  }
  const dq = runs.find(r => isDisqualified(r.outcome));
  if (dq) {
    return { run: dq, penalties: listPenaltiesByRun(dq.id), outcome: dq.outcome, adjusted: null, unit: null, secondsTotal: 0, pointsTotal: 0 };
  }
  return null;
}

function getCompetitionEvents(competition_id) {
  const result = db.exec(
    'SELECT DISTINCT event_type FROM competition_events WHERE competition_id = ? ORDER BY id ASC',
    [competition_id]
  );
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values.map(row => row[0]);
  }
  // Back-compat: competitions row's event_type
  const fallback = db.exec('SELECT event_type FROM competitions WHERE id = ?', [competition_id]);
  if (fallback.length > 0 && fallback[0].values.length > 0) return [fallback[0].values[0][0]];
  return [];
}

function getCompetitionTeams(competition_id) {
  const result = db.exec(
    `SELECT team_id FROM competition_teams WHERE competition_id = ? ORDER BY team_id ASC`,
    [competition_id]
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => row[0]);
}

export function getCompetitionLeaderboard(competition_id) {
  const competition = getCompetitionById(competition_id);
  if (!competition) return { error: 'Competition not found' };

  const events  = getCompetitionEvents(competition_id);
  const teamIds = getCompetitionTeams(competition_id);
  const teams   = teamIds.map(id => getTeamById(id)).filter(Boolean);

  const eventScores = {};
  for (const event_type of events) {
    const entries = teams.map(team => {
      const runs = listRuns({ team_id: team.id, competition_id, event_type });
      const best = bestAttemptForTeam(runs, team);
      return { team, best };
    });

    // Rank finishers by adjusted metric ascending.
    const finishers = entries.filter(e => e.best && e.best.outcome === 'finished');
    finishers.sort((a, b) => a.best.adjusted - b.best.adjusted);

    const ranked = finishers.map((e, i) => {
      const rank = i + 1;
      const points = placePoints(rank, finishers.length) - (e.best.pointsTotal || 0);
      return {
        team_id:        e.team.id,
        team_name:      e.team.team_name,
        rank,
        attempts:       listRuns({ team_id: e.team.id, competition_id, event_type }).length,
        raw_metric:     e.best.run.raw_metric,
        raw_metric_unit: e.best.run.raw_metric_unit,
        penalty_seconds: e.best.secondsTotal,
        penalty_points:  e.best.pointsTotal,
        adjusted:       e.best.adjusted,
        adjusted_unit:  e.best.unit,
        points:         Math.max(0, points),
        outcome:        'finished',
      };
    });

    // Non-finishers (DNF/DQ/DNS) get 0 points and rank null.
    const nonFinishers = entries
      .filter(e => e.best && e.best.outcome !== 'finished')
      .map(e => ({
        team_id:        e.team.id,
        team_name:      e.team.team_name,
        rank:           null,
        attempts:       listRuns({ team_id: e.team.id, competition_id, event_type }).length,
        raw_metric:     null,
        raw_metric_unit: null,
        penalty_seconds: 0,
        penalty_points:  0,
        adjusted:       null,
        adjusted_unit:  null,
        points:         0,
        outcome:        e.best.outcome,
      }));

    // Teams that never ran the event don't show on the leaderboard.
    eventScores[event_type] = [...ranked, ...nonFinishers];
  }

  // Overall = sum of points across events per team.
  const overallMap = new Map();
  for (const event_type of events) {
    for (const row of eventScores[event_type]) {
      const acc = overallMap.get(row.team_id) ?? {
        team_id:   row.team_id,
        team_name: row.team_name,
        total:     0,
        per_event: {},
      };
      acc.total += row.points;
      acc.per_event[event_type] = row.points;
      overallMap.set(row.team_id, acc);
    }
  }
  const overall = [...overallMap.values()]
    .sort((a, b) => b.total - a.total)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  return {
    competition_id,
    competition_name: competition.name,
    events,
    event_scores: eventScores,
    overall,
  };
}
