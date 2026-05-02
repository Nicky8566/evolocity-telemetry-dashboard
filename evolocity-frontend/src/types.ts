export interface ECUFrame {
  ecu_serial: number
  timestamp: string
  voltage_samples: number[]
  current_samples: number[]
  avg_voltage: number
  avg_current: number | null
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
  timeMs: number
  voltage: number
}

export type BoardData = Record<string, Point[]>
export type LatestFrames = Record<string, ECUFrame>
