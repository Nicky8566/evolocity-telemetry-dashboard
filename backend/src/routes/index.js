import { Router } from 'express';
import { getCounterHistory, resetCounter } from '../controllers/counterController.js';
import { receiveECUData, getECUData, getECUSerials } from '../controllers/ecuController.js';
import { getAllTeams, saveTeamInfo, deleteTeamInfo, getTeamByEcu, updateTeamEcu, getTeamByName, getTeamByTeamId, updateTeamPowerLimit } from '../controllers/teamController.js';
import { getAllCompetitions, createNewCompetition, getCompetitionDetails, assignTeam, unassignTeam } from '../controllers/competitionController.js';
import { getAlertsHandler } from '../controllers/alertController.js';
import { startRunHandler, stopRunHandler, listRunsHandler, getRunHandler } from '../controllers/runController.js';

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

// Teams
router.get('/teams', getAllTeams);
router.get('/teams/ecus/:ecu_serial', getTeamByEcu);
router.get('/teams/names/:team_name', getTeamByName);
router.get('/teams/team_ids/:team_id', getTeamByTeamId);
router.post('/teams/create', saveTeamInfo);
router.delete('/teams/:id', deleteTeamInfo);
router.post('/teams/update/ecu', updateTeamEcu);
router.post('/teams/update/power_limit', updateTeamPowerLimit);

// Alerts
router.get('/alerts', getAlertsHandler);

// Competitions
router.get('/competitions', getAllCompetitions);
router.post('/competitions', createNewCompetition);
router.get('/competitions/:id', getCompetitionDetails);
router.post('/competitions/create', createNewCompetition);
router.post('/competitions/assign-team', assignTeam);
router.post('/competitions/unassign-team', unassignTeam);

// Runs
router.get('/runs', listRunsHandler);
router.get('/runs/:id', getRunHandler);
router.post('/runs/start', startRunHandler);
router.post('/runs/:id/stop', stopRunHandler);

export default router;