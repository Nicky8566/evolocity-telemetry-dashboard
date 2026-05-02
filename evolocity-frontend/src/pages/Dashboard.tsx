import { useEffect, useMemo, useState } from "react"
import { teamsApi } from "../api/teams"
import AlertCard from "../components/ui/AlertCard"
import ChartCard from "../components/ui/ChartCard"
import StatCard  from "../components/ui/StatCard"
import { useTelemetry } from "../context/TelemetryContext"
import type { Team } from "../types"

export default function Dashboard() {
  const { boardData, latestFrames, alerts } = useTelemetry()

  const [teams, setTeams]               = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [dateFrom, setDateFrom]         = useState("")
  const [dateTo, setDateTo]             = useState("")

  useEffect(() => {
    teamsApi.list()
      .then(({ data }) => setTeams(data))
      .catch((err) => console.error("Failed to load teams:", err))
  }, [])

  const boardId     = selectedTeam?.ecu_serial ? `ECU-${selectedTeam.ecu_serial}` : null
  const chartData   = boardId ? (boardData[boardId] ?? []) : []
  const latestFrame = boardId ? (latestFrames[boardId] ?? null) : null

  const teamAlerts = useMemo(
    () => selectedTeam
      ? alerts.filter((a) => a.ecu_serial === selectedTeam.ecu_serial)
      : alerts,
    [alerts, selectedTeam],
  )

  // Client-side date range filter on chart data
  const filteredData = useMemo(() => {
    if (!dateFrom && !dateTo) return chartData
    const from = dateFrom ? new Date(dateFrom).getTime() : 0
    const to   = dateTo   ? new Date(dateTo).getTime()   : Infinity
    return chartData.filter((p) => p.timeMs >= from && p.timeMs <= to)
  }, [chartData, dateFrom, dateTo])

  return (
    <div className="flex gap-6 min-h-0 h-full">

      {/* ── Main content ────────────────────────────────────────────────── */}
      {/* (rendered first in DOM, visually left via flex order) */}

      {/* ── Team panel ──────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 flex flex-col gap-4 order-last border-l border-ev-border pl-6">
        <p className="text-xs text-slate-400 uppercase tracking-widest">Teams</p>

        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {teams.length === 0 ? (
            <p className="text-slate-600 text-xs">No teams registered</p>
          ) : (
            teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={[
                  "text-left px-3 py-2.5 rounded-lg border transition-colors",
                  selectedTeam?.id === team.id
                    ? "bg-ev-cyan/10 border-ev-cyan/40 text-white"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-white/5",
                ].join(" ")}
              >
                <p className="text-sm font-medium leading-tight">{team.team_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {team.ecu_serial ? `ECU ${team.ecu_serial}` : "No ECU assigned"}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-5 min-w-0 overflow-y-auto order-first">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Voltage" value={latestFrame?.avg_voltage?.toFixed(2) ?? null} unit="V" />
          <StatCard label="Current" value={latestFrame?.avg_current?.toFixed(2) ?? null} unit="A" />
          <StatCard
            label="Power"
            value={latestFrame?.avg_power?.toFixed(1) ?? null}
            unit="W"
            highlight={latestFrame?.penalty ?? false}
          />
          <StatCard label="Energy"  value={latestFrame?.avg_energy?.toFixed(2)  ?? null} unit="Wh" />
        </div>

        {/* Date range filter */}
        <div className="bg-ev-panel border border-ev-border rounded-xl px-4 py-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">From</label>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-ev-bg border border-ev-border rounded-lg px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">To</label>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-ev-bg border border-ev-border rounded-lg px-3 py-1.5 text-sm text-white"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo("") }}
              className="px-3 py-1.5 text-sm text-slate-400 border border-ev-border rounded-lg hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
          {!selectedTeam && (
            <p className="text-xs text-slate-500 ml-auto self-center">
              ← Select a team to view data
            </p>
          )}
        </div>

        {/* Graphs */}
        <div className="flex flex-col gap-4">
          <ChartCard
            title="Voltage"
            data={filteredData}
            dataKey="voltage"
            color="#00a5c8"
            unit="V"
            domain={[0, 60]}
          />
          <ChartCard
            title="Current"
            data={filteredData}
            dataKey="current"
            color="#ec9c2c"
            unit="A"
            domain={[0, 10]}
          />
        </div>

        {/* Events */}
        <div className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Events</p>
            {teamAlerts.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                {teamAlerts.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
            {teamAlerts.length === 0 ? (
              <p className="text-slate-600 text-sm">No power breach events</p>
            ) : (
              teamAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} teams={teams} />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
