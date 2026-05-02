import {
  insertCompetition,
  getAllCompetitions,
  getCompetitionById,
  addTeamToCompetition,
  removeTeamFromCompetition,
  competitionNameExists
} from '../database/competitionDb.js';

export function createCompetition(name, event_type) {
  if (competitionNameExists(name)) {
    return { error: 'A competition with this name already exists' };
  }
  const id = insertCompetition(name, event_type);
  return getCompetitionById(id);
}

export function getCompetitions() {
  return getAllCompetitions();
}

export function getCompetition(id) {
  return getCompetitionById(id);
}

export function assignTeamToCompetition(competition_id, team_id) {
  return addTeamToCompetition(competition_id, team_id);
}

export function unassignTeamFromCompetition(competition_id, team_id) {
  removeTeamFromCompetition(competition_id, team_id);
}