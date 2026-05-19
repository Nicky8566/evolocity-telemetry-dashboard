import { insertPenalty, updatePenalty, deletePenalty, getPenaltyById, listPenaltiesByRun } from '../database/penaltyDb.js';
import { getRunById } from '../database/runDb.js';
import { PENALTY_TYPES, PENALTY_UNITS } from '../models/penaltyModel.js';
import { broadcastAlert } from '../../websocket.js';

export function applyPenalty({ run_id, penalty_type, value, unit, note, applied_by, source = 'judge' }) {
  if (!run_id || !penalty_type || value == null || !unit) {
    return { error: 'run_id, penalty_type, value, and unit are required' };
  }
  if (!PENALTY_TYPES.includes(penalty_type)) {
    return { error: `penalty_type must be one of: ${PENALTY_TYPES.join(', ')}` };
  }
  if (!PENALTY_UNITS.includes(unit)) {
    return { error: `unit must be one of: ${PENALTY_UNITS.join(', ')}` };
  }
  if (!getRunById(run_id)) return { error: 'Run not found' };

  const id = insertPenalty({ run_id, penalty_type, value, unit, source, note, applied_by });
  const row = getPenaltyById(id);
  broadcastAlert({ type: 'penalty', data: row });
  return row;
}

export function editPenalty(id, { value, unit, note }) {
  const existing = getPenaltyById(id);
  if (!existing) return { error: 'Penalty not found' };
  if (unit !== undefined && !PENALTY_UNITS.includes(unit)) {
    return { error: `unit must be one of: ${PENALTY_UNITS.join(', ')}` };
  }
  updatePenalty(id, { value, unit, note });
  const row = getPenaltyById(id);
  broadcastAlert({ type: 'penalty', data: row });
  return row;
}

export function removePenalty(id) {
  const existing = getPenaltyById(id);
  if (!existing) return { error: 'Penalty not found' };
  deletePenalty(id);
  broadcastAlert({ type: 'penalty-deleted', data: existing });
  return existing;
}

export function getPenaltiesForRun(run_id) {
  return listPenaltiesByRun(run_id);
}
