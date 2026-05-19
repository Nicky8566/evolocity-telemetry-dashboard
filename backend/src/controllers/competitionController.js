import {
  createCompetition,
  getCompetitions,
  getCompetition,
  assignTeamToCompetition,
  unassignTeamFromCompetition,
} from '../services/competitionService.js';
import { getTeamCompetitionAssignments } from '../database/competitionDb.js';

export function getAllCompetitions(req, res) {
  const rows = getCompetitions();
  res.json({ count: rows.length, data: rows });
}

export function createNewCompetition(req, res) {
  const { name, event_type } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Competition name is required' });
  }

  const validTypes = ['drag', 'gymkhana', 'endurance'];
  if (!event_type || !validTypes.includes(event_type)) {
    return res.status(400).json({ error: 'event_type must be drag, gymkhana, or endurance' });
  }

  const result = createCompetition(name.trim(), event_type);
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

export function getTeamAssignments(req, res) {
  const assignments = getTeamCompetitionAssignments();
  res.json({ assignments });
}

export function unassignTeam(req, res) {
  const { competition_id, team_id } = req.body;

  if (!competition_id || !team_id) {
    return res.status(400).json({ error: 'competition_id and team_id are required' });
  }

  unassignTeamFromCompetition(competition_id, team_id);

  res.json({ message: 'Team unassigned from competition' });
}