export interface ECUFrame {
  ecu_serial:      number
  boot_session:    number        // 0 = first boot; increments on each detected reboot
  timestamp:       string        // server receipt ISO — used for exports and DB ordering
  timestamp_ms:    number        // raw device value: uptime_ms (ESP32) or epoch_ms (simulator) — chart x-axis
  uptime_ms?:      number | null // same as timestamp_ms for ESP32 frames; null for simulator
  received_at_ms?: number        // server epoch ms at receipt — used only for liveness detection
  avg_voltage:     number
  avg_current:     number | null
  avg_power:       number | null
  avg_energy:      number | null
  synthetic?:      true          // frontend-only: marks injected zero frames; stripped on real data
}

/** Human-readable label for a device+session. "ESP-2" for boot 0, "ESP-2 (1)" for boot 1, etc. */
export function formatEspLabel(ecu_serial: number, boot_session: number): string {
  return boot_session === 0 ? `ESP-${ecu_serial}` : `ESP-${ecu_serial} (${boot_session})`
}

export interface Team {
  id:            number
  team_name:     string
  team_id:       string
  vehicle_class: string
  vehicle_type:  string
  ecu_serial:    number | null
  power_limit:   number | null
  current_limit: number | null
  joined_at:     string | null
}

export type EventType = "drag" | "gymkhana" | "endurance" | "efficiency"

export const EVENT_TYPES: EventType[] = ["drag", "gymkhana", "endurance", "efficiency"]

export interface Competition {
  id:          number
  name:        string
  event_type:  EventType        // legacy primary event (mirrors event_types[0])
  event_types: EventType[]
  created_at:  string
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
  metric?:     "power" | "current"
  started_at:  string
  ended_at:    string | null
  duration_ms: number | null
}

export type RunOutcome = "running" | "finished" | "dnf" | "dq" | "dns"
export type MetricUnit = "seconds" | "wh"

export interface Run {
  id:              number
  team_id:         number
  competition_id:  number
  event_type:      EventType
  attempt_number:  number
  started_at:      string
  ended_at:        string | null
  outcome:         RunOutcome
  raw_metric:      number | null
  raw_metric_unit: MetricUnit | null
}

export type PenaltyType =
  | "cone_hit" | "false_start" | "failure_to_stop" | "course_cut" | "dangerous"
  | "power_zone" | "dnf" | "dq" | "dns" | "other"

export interface Penalty {
  id:           number
  run_id:       number
  penalty_type: PenaltyType
  value:        number
  unit:         "seconds" | "points"
  source:       "judge" | "auto"
  note:         string | null
  applied_at:   string
  applied_by:   string | null
}

export interface LeaderboardEntry {
  team_id:         number
  team_name:       string
  rank:            number | null
  attempts:        number
  raw_metric:      number | null
  raw_metric_unit: MetricUnit | null
  penalty_seconds: number
  penalty_points:  number
  adjusted:        number | null
  adjusted_unit:   MetricUnit | null
  points:          number
  outcome:         RunOutcome
}

export interface OverallEntry {
  team_id:   number
  team_name: string
  total:     number
  rank:      number
  per_event: Record<string, number>
}

export interface CompetitionLeaderboard {
  competition_id:   number
  competition_name: string
  events:           EventType[]
  event_scores:     Record<EventType, LeaderboardEntry[]>
  overall:          OverallEntry[]
}
