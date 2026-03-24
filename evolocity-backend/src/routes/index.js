import { Router } from 'express';
import { getCounterHistory, resetCounter } from '../controllers/counterController.js';
import { receiveECUData, getECUData } from '../controllers/ecuController.js';
 
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
 
export default router;