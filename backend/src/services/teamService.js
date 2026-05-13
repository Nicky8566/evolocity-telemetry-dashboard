import { insertTeam, getAllTeams, updateTeamEcu, getTeamByEcu, getTeamByName, getTeamByTeamId, getTeamById, deleteTeamById, updateTeamPowerLimit as dbUpdateTeamPowerLimit } from '../database/teamDb.js';

export function saveTeam(payload) {
  const { name, team_id, vehicle_class, vehicle_type, ecu_serial, power_limit } = payload;
  return insertTeam({
    team_name: name,
    team_id,
    vehicle_class: vehicle_class.toLowerCase(),
    vehicle_type: vehicle_type.toLowerCase(),
    ecu_serial: ecu_serial || null,
    power_limit: power_limit ?? null,
  });
}

export function updateTeamPowerLimit(id, power_limit) {
  dbUpdateTeamPowerLimit(id, power_limit ?? null);
}

export function getTeams() {
  return getAllTeams();
}

export function updateTeamEcuSerial(payload) {
  const { id, ecu_serial } = payload;
  updateTeamEcu({
    id,
    ecu_serial: ecu_serial || null
  });
}

export function getTeamByEcuSerial(ecu_serial) {
  return getTeamByEcu(parseInt(ecu_serial));
}

export function getTeamByTeamName(team_name) {
  return getTeamByName(team_name);
}

export function getTeamByTeamID(team_id) {
  return getTeamByTeamId(team_id);
}

export function getTeam(id) {
  return getTeamById(id);
}

export function deleteTeam(id) {
  deleteTeamById(id);
}
