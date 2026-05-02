import type { Alert, Team } from "../../types"

interface Props {
  alert: Alert
  teams: Team[]   // passed in so we can resolve ecu_serial → team name
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
    <div
      className={[
        "rounded-xl border p-4 flex flex-col gap-2 transition-colors",
        isActive
          ? "border-red-500/60 bg-red-950/30"
          : "border-ev-border bg-ev-panel",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">
              {team ? team.team_name : `ESP-${alert.ecu_serial}`}
            </p>
            {team && (
              <p className="text-slate-500 text-xs">ESP-{alert.ecu_serial}</p>
            )}
          </div>
        </div>

        {isActive ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse">
            ACTIVE
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            {formatTime(alert.started_at)}
          </span>
        )}
      </div>

      {/* Power reading */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-red-400 tabular-nums">
          {alert.power_value.toFixed(0)} W
        </span>
        <span className="text-slate-400 text-sm">
          exceeded {alert.threshold} W limit
        </span>
      </div>

      {/* Duration */}
      <p className="text-xs text-slate-500">
        Duration: <span className="text-slate-300">{formatDuration(alert.duration_ms)}</span>
      </p>
    </div>
  )
}
