export interface ECUFrame {
  ecu_serial:  number
  timestamp:   string
  avg_voltage: number
  avg_current: number | null
  avg_power:   number | null
  avg_energy:  number | null
}

export interface Team {
  id:            number
  team_name:     string
  team_id:       string
  vehicle_class: string
  vehicle_type:  string
  ecu_serial:    number | null
}

export interface Competition {
  id:         number
  name:       string
  event_type: "drag" | "gymkhana" | "endurance"
  created_at: string
}

export interface CompetitionDetail extends Competition {
  teams: Team[]
}

export interface CreateTeamPayload {
  name:          string
  team_id:       string
  vehicle_class: string
  vehicle_type:  string
  ecu_serial:    string
}

export type BoardData = Record<string, ECUFrame[]>

export interface Alert {
  id:          number
  ecu_serial:  number
  type:        "warning" | "penalty"
  power_value: number
  threshold:   number
  started_at:  string
  ended_at:    string | null
  duration_ms: number | null
}
