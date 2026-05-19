import {
  createCompetition,
  getCompetitions,
  getCompetition,
  assignTeamToCompetition,
  unassignTeamFromCompetition,
} from '../services/competitionService.js';
import { EVENT_TYPES } from '../models/competitionModel.js';

export function getAllCompetitions(req, res) {
  const rows = getCompetitions();
  res.json({ count: rows.length, data: rows });
}

export function createNewCompetition(req, res) {
  const { name, event_type, event_types } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Competition name is required' });
  }

  // Accept either event_types[] (preferred) or single event_type (legacy).
  const requested = Array.isArray(event_types) && event_types.length > 0
    ? event_types
    : (event_type ? [event_type] : []);
  if (requested.length === 0) {
    return res.status(400).json({ error: 'event_types[] (or event_type) is required' });
  }
  const invalid = requested.filter(e => !EVENT_TYPES.includes(e));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid event_types: ${invalid.join(', ')}. Allowed: ${EVENT_TYPES.join(', ')}` });
  }
  const deduped = [...new Set(requested)];

  const result = createCompetition(name.trim(), deduped);
  if (result.error) {
    return res.status(409).json({ error: result.error });
  }

  res.json({ data: result });
}

export function getCompetitionDetails(req, res) {
  const competition = getCompetition(parseInt(req.params.id));
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }
  res.json({ data: competition });
}

export function assignTeam(req, res) {
  const { competition_id, team_id } = req.body;
  if (!competition_id || !team_id) {
    return res.status(400).json({ error: 'competition_id and team_id are required' });
  }
  const assigned = assignTeamToCompetition(competition_id, team_id);
  if (!assigned) {
    return res.status(409).json({ error: 'Team is already assigned to this competition' });
  }
  res.json({ message: 'Team assigned to competition' });
}

export function unassignTeam(req, res) {
  const { competition_id, team_id } = req.body;

  if (!competition_id || !team_id) {
    return res.status(400).json({ error: 'competition_id and team_id are required' });
  }

  unassignTeamFromCompetition(competition_id, team_id);

  res.json({ message: 'Team unassigned from competition' });
}