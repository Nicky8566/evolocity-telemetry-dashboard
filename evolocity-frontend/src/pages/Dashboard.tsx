import { useEffect, useMemo, useState } from "react"
import { teamsApi } from "../api/teams"
import AlertCard from "../components/ui/AlertCard"
import ChartCard from "../components/ui/ChartCard"
import StatCard  from "../components/ui/StatCard"
import { useTelemetry } from "../context/TelemetryContext"
import type { Team } from "../types"

export default function Dashboard() {
  const { boardData, alerts } = useTelemetry()

  const [teams, setTeams]               = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>({
    id: 1, team_name: "Team Thunder", team_id: "T01",
    vehicle_class: "Standard", vehicle_type: "Kart", ecu_serial: 12345,
  })
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo]     = useState("")

  useEffect(() => {
    teamsApi.list()
      .then(({ data }) => setTeams(data))
      .catch((err) => console.error("Failed to load teams:", err))
  }, [])

  const boardId    = selectedTeam?.ecu_serial ? `ECU-${selectedTeam.ecu_serial}` : null
  const frames     = boardId ? (boardData[boardId] ?? []) : []
  const latestFrame = frames.at(-1) ?? null

  const teamAlerts = useMemo(
    () => selectedTeam
      ? alerts.filter((a) => a.ecu_serial === selectedTeam.ecu_serial)
      : alerts,
    [alerts, selectedTeam],
  )

  const activePenalty = useMemo(
    () => teamAlerts.some((a) => a.type === "penalty" && a.ended_at === null),
    [teamAlerts],
  )

  const filteredFrames = useMemo(() => {
    if (!dateFrom && !dateTo) return frames
    const from = dateFrom ? new Date(dateFrom).getTime() : 0
    const to   = dateTo   ? new Date(dateTo).getTime()   : Infinity
    return frames.filter((f) => {
      const t = new Date(f.timestamp).getTime()
      return t >= from && t <= to
    })
  }, [frames, dateFrom, dateTo])

  return (
    <div className="flex gap-8 min-h-0 h-full">

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 order-first">

        {/* Page header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {selectedTeam
                ? `Viewing · ${selectedTeam.team_name} · ECU ${selectedTeam.ecu_serial ?? "unassigned"}`
                : "Select a team from the panel to view telemetry"}
            </p>
          </div>

          {/* Date range filter */}
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">From</label>
              <input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border border-ev-border rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-ev-cyan"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">To</label>
              <input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border border-ev-border rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-ev-cyan"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo("") }}
                className="py-1.5 px-3 text-xs text-slate-400 hover:text-white border border-ev-border rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* No team selected — empty state */}
        {!selectedTeam ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-40 select-none">
            <p className="text-5xl">📡</p>
            <p className="text-slate-700 font-medium">No team selected</p>
            <p className="text-slate-400 text-sm">Pick a team from the panel on the right</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Voltage" value={latestFrame?.avg_voltage?.toFixed(2) ?? null} unit="V" accentClass="border-t-ev-cyan" />
              <StatCard label="Current" value={latestFrame?.avg_current?.toFixed(2) ?? null} unit="A" accentClass="border-t-ev-orange" />
              <StatCard
                label="Power"
                value={latestFrame?.avg_power?.toFixed(1) ?? null}
                unit="W"
                highlight={activePenalty}
                accentClass="border-t-ev-blue"
              />
              <StatCard label="Energy" value={latestFrame?.avg_energy?.toFixed(2) ?? null} unit="Wh" accentClass="border-t-green-500" />
            </div>

            {/* Graphs */}
            <div className="flex flex-col gap-4">
              <ChartCard title="Voltage" data={filteredFrames} dataKey="avg_voltage" color="#00a5c8" unit="V" domain={[0, 60]} />
              <ChartCard title="Current" data={filteredFrames} dataKey="avg_current" color="#ec9c2c" unit="A" domain={[0, 10]} />
            </div>

            {/* Events */}
            <div className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Events</p>
                {teamAlerts.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                    {teamAlerts.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto max-h-56">
                {teamAlerts.length === 0 ? (
                  <p className="text-slate-600 text-sm">No power breach events</p>
                ) : (
                  teamAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} teams={teams} />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Team panel ──────────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 flex flex-col gap-4 order-last border-l border-ev-cyan/30 pl-6">
        <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Teams</p>
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
                    ? "bg-ev-blue text-white border-ev-blue"
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100",
                ].join(" ")}
              >
                <p className="text-sm font-medium leading-tight text-slate-900">{team.team_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {team.ecu_serial ? `ECU ${team.ecu_serial}` : "No ECU"}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

    </div>
  )
}
