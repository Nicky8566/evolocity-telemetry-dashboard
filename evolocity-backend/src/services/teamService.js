import { insertTeam, getAllTeams, updateTeamEcu, getTeamByEcu, getTeamByName } from '../database/db.js';

// function to save team information
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

export function updateTeamEcuSerial(payload) {
	const { id, ecu_serial } = payload;
	let ecu = ecu_serial;
	if (ecu_serial === "") {
		ecu = null;
	}
	const team = {
		id: id,
		ecu_serial: ecu
	}
	updateTeamEcu(team);
}

export function getTeamByEcuSerial(ecu_serial) {
	return getTeamByEcu(parseInt(ecu_serial));
}

export function getTeamByTeamName(team_name) {
	console.log(team_name + " name")
	return getTeamByName(team_name);
}