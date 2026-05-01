import { getTeams, saveTeam, getTeamByEcuSerial, updateTeamEcuSerial, getTeamByTeamName } from '../services/teamService.js';
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

export function updateTeamEcu(req, res) {
	console.log('Headers:', req.headers);
  console.log('Body:', req.body); 
  const payload = req.body;
	updateTeamEcuSerial(payload);
	res.json({ message: 'Updated team ecu' });
}

export function getTeamByEcu(req, res) {
	console.log('Params:', req.params);
  const payload = req.params.ecu_serial;
	const rows = getTeamByEcuSerial(payload);
	res.json({ count: rows.length, data: rows });
}

export function getTeamByName(req, res) {
	console.log('Params:', req.params);
  const payload = req.params.team_name;
	const rows = getTeamByTeamName(payload);
	res.json({ count: rows.length, data: rows });
}