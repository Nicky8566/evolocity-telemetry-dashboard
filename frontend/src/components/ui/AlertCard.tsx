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
  const team      = teams.find((t) => t.ecu_serial === alert.ecu_serial)
  const isActive  = alert.ended_at === null
  const isPenalty = alert.type === "penalty"

  const containerClass = isActive
    ? isPenalty
      ? "border-red-200 bg-red-50"
      : "border-amber-200 bg-amber-50"
    : "border-ev-border bg-ev-panel"

  const badgeClass = isPenalty
    ? "bg-red-100 text-red-600"
    : "bg-amber-100 text-amber-600"

  const valueClass = isPenalty ? "text-red-500" : "text-amber-500"

  return (
    <div className={`rounded-lg border px-2.5 py-1.5 flex flex-col gap-1 transition-colors ${containerClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-slate-900 font-semibold text-xs leading-tight truncate">
          {team ? (
            <>
              {team.team_name} <span className="font-normal text-[10px] text-slate-400">· ESP-{alert.ecu_serial}</span>
            </>
          ) : (
            `ESP-${alert.ecu_serial}`
          )}
        </p>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass} ${isActive ? "animate-pulse" : ""}`}>
          {isPenalty ? "PENALTY" : "WARNING"}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold tabular-nums ${valueClass}`}>
          {alert.power_value.toFixed(0)}W
        </span>
        <span className="text-[10px] text-slate-500">exceeded {alert.threshold}W limit</span>
      </div>

      <div className="flex items-baseline justify-between gap-1.5">
        <p className="text-[10px] text-slate-500">
          Duration: <span className="text-slate-700">{formatDuration(alert.duration_ms)}</span>
        </p>
        {!isActive && (
          <span className="text-[10px] text-slate-400">{formatTime(alert.started_at)}</span>
        )}
      </div>
    </div>
  )
}
