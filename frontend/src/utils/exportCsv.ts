import type { Alert, Competition, ECUFrame, Team } from "../types"

type FrameInput = Omit<ECUFrame, "timestamp_ms" | "synthetic">

const FRAME_COLS: (keyof FrameInput)[] = [
  "timestamp",
  "uptime_ms",
  "ecu_serial",
  "avg_voltage",
  "avg_current",
  "avg_power",
  "avg_energy",
]

const FRAME_HEADERS: Record<string, string> = {
  timestamp:    "Timestamp (UTC)",
  uptime_ms:    "Device Timestamp (ms)",
  ecu_serial:   "ECU Serial",
  avg_voltage:  "Voltage (V)",
  avg_current:  "Current (A)",
  avg_power:    "Power (W)",
  avg_energy:   "Energy (Wh)",
  timestamp_ms: "Timestamp (ms)",
}

function escape(val: unknown): string {
  if (val == null) return ""
  const s = String(val)
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

export function downloadCsv(
  frames: FrameInput[],
  team: Team | null,
  competition: Competition | null,
  alerts: Alert[],
) {
  // Discover any extra keys present in data beyond the known columns
  // (future-proofing: new ECUFrame fields are picked up automatically)
  const extraKeys = frames.length
    ? (Object.keys(frames[0]) as (keyof FrameInput)[]).filter(
        (k) => !FRAME_COLS.includes(k),
      )
    : []
  const allCols = [...FRAME_COLS, ...extraKeys]

  const lines: string[] = []

  // ── Metadata block ───────────────────────────────────────────────────────
  lines.push("# EVolocity Post-Race Report")
  lines.push(`# Generated,${escape(new Date().toISOString())}`)
  if (competition) {
    lines.push(`# Competition,${escape(competition.name)}`)
    lines.push(`# Event Type,${escape(competition.event_type)}`)
  }
  lines.push(`# Team Name,${escape(team?.team_name ?? "Unassigned")}`)
  lines.push(`# Team ID,${escape(team?.team_id ?? "N/A")}`)
  lines.push(`# Vehicle Class,${escape(team?.vehicle_class ?? "N/A")}`)
  lines.push(`# Vehicle Type,${escape(team?.vehicle_type ?? "N/A")}`)
  lines.push(`# ECU Serial,${escape(team?.ecu_serial ?? frames[0]?.ecu_serial ?? "N/A")}`)
  lines.push(`# Power Limit,${escape(team?.power_limit != null ? `${team.power_limit}W` : "N/A")}`)
  lines.push(`# Current Limit,${escape(team?.current_limit != null ? `${team.current_limit}A` : "N/A")}`)
  lines.push("#")

  // ── Run summary ──────────────────────────────────────────────────────────
  if (frames.length) {
    const first = frames[0].timestamp
    const last  = frames[frames.length - 1].timestamp
    const dur   = new Date(last).getTime() - new Date(first).getTime()
    const mins  = Math.floor(dur / 60000)
    const secs  = Math.floor((dur % 60000) / 1000)
    const peak  = Math.max(...frames.map((f) => f.avg_power ?? 0))
    const total = frames.reduce((s, f) => s + (f.avg_energy ?? 0), 0)
    lines.push(`# Run Start,${escape(first)}`)
    lines.push(`# Run End,${escape(last)}`)
    lines.push(`# Duration,${mins}m ${secs}s`)
    lines.push(`# Total Frames,${frames.length}`)
    lines.push(`# Peak Power,${peak.toFixed(2)}W`)
    lines.push(`# Total Energy,${total.toFixed(4)}Wh`)
  }
  lines.push("#")

  // ── Alerts section ───────────────────────────────────────────────────────
  lines.push("# LIMIT BREACH EVENTS")
  lines.push("# Type,Metric,Started At,Ended At,Duration (ms),Peak Value,Threshold")
  if (alerts.length === 0) {
    lines.push("# (none)")
  } else {
    for (const a of alerts) {
      lines.push(
        `# ${[a.type, a.metric ?? "power", a.started_at, a.ended_at ?? "", a.duration_ms ?? "", a.power_value, a.threshold]
          .map(escape)
          .join(",")}`,
      )
    }
  }
  lines.push("#")

  // ── Telemetry data ───────────────────────────────────────────────────────
  lines.push("# TELEMETRY DATA")
  const headerRow = allCols
    .map((k) => FRAME_HEADERS[k as keyof typeof FRAME_HEADERS] ?? String(k))
    .join(",")
  lines.push(headerRow)

  for (const f of frames) {
    lines.push(allCols.map((k) => escape(f[k])).join(","))
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  const date = new Date().toISOString().slice(0, 10)
  const comp = competition ? `_${slugify(competition.name)}` : ""
  a.href     = url
  const teamSlug = team ? slugify(team.team_name) : `esp${frames[0]?.ecu_serial ?? "unknown"}`
  a.download = `evolocity_${teamSlug}${comp}_${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
