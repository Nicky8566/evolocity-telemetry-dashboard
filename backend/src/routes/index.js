import { Router } from 'express';
import { getCounterHistory, resetCounter } from '../controllers/counterController.js';
import { receiveECUData, getECUData, getECUSerials, getECUStatus, deleteECU } from '../controllers/ecuController.js';
import { getAllTeams, saveTeamInfo, deleteTeamInfo, getTeamByEcu, updateTeamEcu, getTeamByName, getTeamByTeamId, updateTeamPowerLimit, updateTeamCurrentLimit } from '../controllers/teamController.js';
import { getAllCompetitions, createNewCompetition, getCompetitionDetails, assignTeam, unassignTeam, getTeamAssignments } from '../controllers/competitionController.js';
import { getAlertsHandler } from '../controllers/alertController.js';
import { startRunHandler, stopRunHandler, listRunsHandler, getRunHandler } from '../controllers/runController.js';
import { createPenaltyHandler, updatePenaltyHandler, deletePenaltyHandler, listPenaltiesHandler } from '../controllers/penaltyController.js';
import { getLeaderboardHandler } from '../controllers/scoringController.js';

const router = Router();

// Health check
router.get('/', (_req, res) => {
  res.json({ message: 'EVolocity backend is running.' });
});

// Counter (placeholder)
router.get('/counter/history', getCounterHistory);
router.delete('/counter/reset', resetCounter);

// ECU data
router.post('/data', receiveECUData);
router.get('/ecu/history', getECUData);
router.get('/ecu/serials', getECUSerials);
router.get('/ecu/status', getECUStatus);
router.delete('/ecu/:serial', deleteECU);

// Teams
router.get('/teams', getAllTeams);
router.get('/teams/ecus/:ecu_serial', getTeamByEcu);
router.get('/teams/names/:team_name', getTeamByName);
router.get('/teams/team_ids/:team_id', getTeamByTeamId);
router.post('/teams/create', saveTeamInfo);
router.delete('/teams/:id', deleteTeamInfo);
router.post('/teams/update/ecu', updateTeamEcu);
router.post('/teams/update/power_limit', updateTeamPowerLimit);
router.post('/teams/update/current_limit', updateTeamCurrentLimit);

// Alerts
router.get('/alerts', getAlertsHandler);

// Competitions
router.get('/competitions', getAllCompetitions);
router.post('/competitions', createNewCompetition);
router.get('/competitions/team-assignments', getTeamAssignments);
router.get('/competitions/:id', getCompetitionDetails);
router.post('/competitions/create', createNewCompetition);
router.post('/competitions/assign-team', assignTeam);
router.post('/competitions/unassign-team', unassignTeam);
router.get('/competitions/:id/leaderboard', getLeaderboardHandler);

// Runs
router.get('/runs', listRunsHandler);
router.get('/runs/:id', getRunHandler);
router.post('/runs/start', startRunHandler);
router.post('/runs/:id/stop', stopRunHandler);

// Penalties
router.get('/penalties', listPenaltiesHandler);
router.post('/penalties', createPenaltyHandler);
router.patch('/penalties/:id', updatePenaltyHandler);
router.delete('/penalties/:id', deletePenaltyHandler);

export default router;
