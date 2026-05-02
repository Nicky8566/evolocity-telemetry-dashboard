import type { Alert, Team } from "../../types"

interface Props {
  alert: Alert
  teams: Team[]
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "ongoing"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function AlertCard({ alert, teams }: Props) {
  const team     = teams.find((t) => t.ecu_serial === alert.ecu_serial)
  const isActive = alert.ended_at === null

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 transition-colors ${isActive ? "border-red-200 bg-red-50" : "border-ev-border bg-ev-panel"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-slate-900 font-semibold text-sm leading-tight">
              {team ? team.team_name : `ESP-${alert.ecu_serial}`}
            </p>
            {team && <p className="text-slate-400 text-xs">ESP-{alert.ecu_serial}</p>}
          </div>
        </div>

        {isActive ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">
            ACTIVE
          </span>
        ) : (
          <span className="text-xs text-slate-400">{formatTime(alert.started_at)}</span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-red-500 tabular-nums">
          {alert.power_value.toFixed(0)} W
        </span>
        <span className="text-slate-500 text-sm">exceeded {alert.threshold} W limit</span>
      </div>

      <p className="text-xs text-slate-400">
        Duration: <span className="text-slate-600">{formatDuration(alert.duration_ms)}</span>
      </p>
    </div>
  )
}
