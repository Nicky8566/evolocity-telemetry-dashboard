import { Router } from 'express';

const router = Router();

// Health check
router.get('/', (req, res) => {
  res.json({ message: 'EVolocity backend is running.' });
});

export default router;