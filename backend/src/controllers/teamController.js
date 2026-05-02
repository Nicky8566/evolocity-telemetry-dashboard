import { getTeams, saveTeam, getTeamByEcuSerial, updateTeamEcuSerial, getTeamByTeamName, getTeamByTeamID, updateTeamPowerLimit as setPowerLimit } from '../services/teamService.js';
import { broadcast } from '../../websocket.js';

export function getAllTeams(req, res) {
  const rows = getTeams();
  res.json({ count: rows.length, data: rows });
}

export function saveTeamInfo(req, res) {
  const { name, team_id, vehicle_class, vehicle_type } = req.body;

  // Validation — was missing entirely, garbage data could go straight to DB
  if (!name || !team_id || !vehicle_class || !vehicle_type) {
    return res.status(400).json({
      error: 'Missing required fields: name, team_id, vehicle_class, vehicle_type'
    });
  }

  const validClasses = ['standard', 'open'];
  const validTypes = ['kart', 'bike'];

  if (!validClasses.includes(vehicle_class.toLowerCase())) {
    return res.status(400).json({ error: 'vehicle_class must be standard or open' });
  }
  if (!validTypes.includes(vehicle_type.toLowerCase())) {
    return res.status(400).json({ error: 'vehicle_type must be kart or bike' });
  }

  const id = saveTeam(req.body);
  const team = {
    id,
    team_name:     name,
    team_id,
    vehicle_class: vehicle_class.toLowerCase(),
    vehicle_type:  vehicle_type.toLowerCase(),
    ecu_serial:    req.body.ecu_serial ? parseInt(req.body.ecu_serial) : null,
    power_limit:   req.body.power_limit ?? null,
  };
  broadcast({ type: 'team', data: team });
  res.json({ data: team });
}

export function updateTeamEcu(req, res) {
  const payload = req.body;
  if (payload.id == null) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }
  updateTeamEcuSerial(payload);
  res.json({ message: 'Updated team ecu' });
}

export function getTeamByEcu(req, res) {
  const rows = getTeamByEcuSerial(req.params.ecu_serial);
  res.json({ count: rows.length, data: rows });
}

export function getTeamByName(req, res) {
  const rows = getTeamByTeamName(req.params.team_name);
  res.json({ count: rows.length, data: rows });
}

export function getTeamByTeamId(req, res) {
  const rows = getTeamByTeamID(req.params.team_id);
  res.json({ count: rows.length, data: rows });
}

export function updateTeamPowerLimit(req, res) {
  const { id, power_limit } = req.body;
  if (id == null) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }
  setPowerLimit(id, power_limit ?? null);
  res.json({ message: 'Updated team power limit' });
}