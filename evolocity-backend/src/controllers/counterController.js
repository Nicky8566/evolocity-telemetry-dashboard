import { getHistory, resetHistory } from '../services/counterService.js';

export function getCounterHistory(req, res) {
  const rows = getHistory();
  res.json({ count: rows.length, data: rows });
}

export function resetCounter(req, res) {
  resetHistory();
  res.json({ message: 'Counter history cleared.' });
}