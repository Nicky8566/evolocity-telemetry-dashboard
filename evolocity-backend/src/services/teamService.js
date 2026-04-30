import { insertTeam, getAllTeams } from '../database/db.js';

export function saveTeam(payload) {
	const { name, team_id, vehicle_class, vehicle_type, ecu_serial } = payload;
	let ecu = ecu_serial;
	if (ecu_serial === "") {
		ecu = null;
	}
	const team = {
		team_name: name,
		team_id: team_id,
		vehicle_class: vehicle_class,
		vehicle_type: vehicle_type,
		ecu_serial: ecu
	}
	
	insertTeam(team);
}

export function getTeams() {
	return getAllTeams();
}
