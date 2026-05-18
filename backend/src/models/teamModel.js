// teamModel — shape and DDL for the teams table

export const teamSchema = {
  id:            'INTEGER PRIMARY KEY AUTOINCREMENT',
  team_name:     'TEXT NOT NULL',
  team_id:       'TEXT NOT NULL',
  vehicle_class: "TEXT CHECK(vehicle_class IN ('standard', 'open')) NOT NULL",
  vehicle_type:  "TEXT CHECK(vehicle_type IN ('kart', 'bike')) NOT NULL",
  ecu_serial:    'INTEGER',
  power_limit:   'INTEGER',
};

export const teamDDL = `
  CREATE TABLE IF NOT EXISTS teams (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name     TEXT NOT NULL,
    team_id       TEXT NOT NULL,
    vehicle_class TEXT CHECK(vehicle_class IN ('standard', 'open')) NOT NULL,
    vehicle_type  TEXT CHECK(vehicle_type IN ('kart', 'bike')) NOT NULL,
    ecu_serial    INTEGER,
    power_limit   INTEGER
  )
`;
