import { startRun, stopRun, getRuns, getRun } from '../services/runService.js';

export function startRunHandler(req, res) {
  const { team_id, competition_id, event_type } = req.body;
  const result = startRun({ team_id, competition_id, event_type });
  if (result?.error) return res.status(400).json({ error: result.error });
  res.json({ data: result });
}

export function stopRunHandler(req, res) {
  const id = parseInt(req.params.id);
  const { outcome } = req.body || {};
  const result = stopRun(id, { outcome });
  if (result?.error) return res.status(400).json({ error: result.error });
  res.json({ data: result });
}

export function listRunsHandler(req, res) {
  const { team_id, competition_id, event_type } = req.query;
  const rows = getRuns({
    team_id:        team_id        ? parseInt(team_id)        : undefined,
    competition_id: competition_id ? parseInt(competition_id) : undefined,
    event_type,
  });
  res.json({ count: rows.length, data: rows });
}

export function getRunHandler(req, res) {
  const run = getRun(parseInt(req.params.id));
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json({ data: run });
}
