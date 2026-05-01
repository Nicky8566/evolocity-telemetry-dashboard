import { Router } from 'express';
import { getCounterHistory, resetCounter } from '../controllers/counterController.js';
import { receiveECUData, getECUData, getECUSerials } from '../controllers/ecuController.js';
import { getAllTeams, saveTeamInfo, getTeamByEcu, updateTeamEcu, getTeamByName, getTeamByTeamId } from '../controllers/teamController.js';
 
const router = Router();
 
// Health check
router.get('/', (req, res) => {
  res.json({ message: 'EVolocity backend is running.' });
});
 
// Counter (placeholder)
router.get('/counter/history', getCounterHistory);
router.delete('/counter/reset', resetCounter);
 
// ECU data — ESP32/simulator posts here, frontend fetches history here
router.post('/data', receiveECUData);          // matches simulator: POST /api/data
router.get('/ecu/history', getECUData);
router.get('/ecu/serials', getECUSerials);

// Team data
router.get('/teams', getAllTeams);
router.get('/teams/ecus/:ecu_serial', getTeamByEcu);
router.get('/teams/names/:team_name', getTeamByName);
router.get('/teams/team_ids/:team_id', getTeamByTeamId);
router.post('/teams/create', saveTeamInfo);
router.post('/teams/update/ecu', updateTeamEcu);
 
export default router;