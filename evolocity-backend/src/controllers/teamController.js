import { getTeams, saveTeam } from '../services/teamService.js';
import { broadcast } from '../../websocket.js';

export function getAllTeams(req, res) {
	const rows = getTeams();
	res.json({ count: rows.length, data: rows });
}

export function saveTeamInfo(req, res) {
	console.log('Headers:', req.headers);
  console.log('Body:', req.body); 
  const payload = req.body;
	saveTeam(payload);
	broadcast({
    type: 'team',
    data: payload
  });
	res.json({ message: 'Saved new team' });
}

// export function updateTeamInfo(req, res) {
// 	console.log('Headers:', req.headers);
//   console.log('Body:', req.body); 
//   const payload = req.body;
// 	updateTeam(payload);
// 	res.json({ message: 'Updated team information' });
// }