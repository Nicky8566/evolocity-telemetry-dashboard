export interface ECUFrame {
  ecu_serial: number
  timestamp: string
  voltage_samples: number[]
  current_samples: number[]
  avg_voltage: number
  avg_current: number | null
  avg_power:   number | null
  avg_energy:  number | null  // cumulative Wh
  penalty: boolean
}

export interface HistoryRow {
  id: number
  ecu_serial: number
  timestamp: string
  avg_voltage: number
  avg_current: number | null
  penalty: number
  recorded_at: string
}

export interface Team {
  id: number
  team_name: string
  team_id: string
  vehicle_class: string
  vehicle_type: string
  ecu_serial: number | null
}

export interface Competition {
  id: number
  name: string
  created_at: string
  events?: string[]
}

export interface CreateTeamPayload {
  name: string
  team_id: string
  vehicle_class: string
  vehicle_type: string
  ecu_serial: string
}

export interface Point {
  timeMs:  number
  voltage: number
  current: number | null
}

export type BoardData = Record<string, Point[]>
export type LatestFrames = Record<string, ECUFrame>

export interface Alert {
  id: number
  ecu_serial: number
  power_value: number      // peak power during the breach (W)
  threshold: number        // limit that was exceeded (W)
  started_at: string       // ISO — when power first crossed the threshold
  ended_at: string | null  // ISO — when it dropped back below (null = still active)
  duration_ms: number | null
}
