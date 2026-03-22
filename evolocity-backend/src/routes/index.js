import { Router } from 'express';
import { getCounterHistory, resetCounter } from '../controllers/valueController.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'EVolocity backend is running.' });
});

router.get('/counter/history', getCounterHistory);
router.delete('/counter/reset', resetCounter);

export default router;