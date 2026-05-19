import { getCompetitionLeaderboard } from '../services/scoringService.js';

export function getLeaderboardHandler(req, res) {
  const competition_id = parseInt(req.params.id);
  const result = getCompetitionLeaderboard(competition_id);
  if (result?.error) return res.status(404).json({ error: result.error });
  res.json({ data: result });
}
