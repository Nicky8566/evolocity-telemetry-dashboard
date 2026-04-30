import { Router } from 'express';
import { getCounterHistory, resetCounter } from '../controllers/counterController.js';
import { receiveECUData, getECUData, getECUSerials } from '../controllers/ecuController.js';
import { getAllTeams, saveTeamInfo } from '../controllers/teamController.js';
 
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
router.post('/teams/create', saveTeamInfo);
 
export default router;