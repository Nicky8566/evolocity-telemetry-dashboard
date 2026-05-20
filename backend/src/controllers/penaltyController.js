import { applyPenalty, editPenalty, removePenalty, getPenaltiesForRun } from '../services/penaltyService.js';

export function createPenaltyHandler(req, res) {
  const { run_id, penalty_type, value, unit, note, applied_by } = req.body;
  const result = applyPenalty({ run_id, penalty_type, value, unit, note, applied_by });
  if (result?.error) return res.status(400).json({ error: result.error });
  res.json({ data: result });
}

export function updatePenaltyHandler(req, res) {
  const id = parseInt(req.params.id);
  const { value, unit, note } = req.body || {};
  const result = editPenalty(id, { value, unit, note });
  if (result?.error) return res.status(400).json({ error: result.error });
  res.json({ data: result });
}

export function deletePenaltyHandler(req, res) {
  const id = parseInt(req.params.id);
  const result = removePenalty(id);
  if (result?.error) return res.status(404).json({ error: result.error });
  res.json({ data: result });
}

export function listPenaltiesHandler(req, res) {
  const { run_id } = req.query;
  if (!run_id) return res.status(400).json({ error: 'run_id query parameter is required' });
  const rows = getPenaltiesForRun(parseInt(run_id));
  res.json({ count: rows.length, data: rows });
}
