import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { competitionsApi } from "../api/competitions"
import AlertCard from "../components/ui/AlertCard"
import ChartCard from "../components/ui/ChartCard"
import StatCard  from "../components/ui/StatCard"
import { useTelemetry } from "../context/TelemetryContext"
import type { CompetitionDetail, Team } from "../types"

const EVENT_COLOURS: Record<string, string> = {
  drag:      "bg-ev-cyan/10 text-ev-cyan border-ev-cyan/30",
  gymkhana:  "bg-purple-500/10 text-purple-400 border-purple-400/30",
  endurance: "bg-orange-500/10 text-orange-400 border-orange-400/30",
}

export default function CompetitionDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { boardData, alerts } = useTelemetry()

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo]     = useState("")

  useEffect(() => {
    if (!id) return
    competitionsApi.getById(parseInt(id))
      .then(({ data }) => {
        setCompetition(data)
        if (data.teams.length > 0) setSelectedTeam(data.teams[0])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [id])

  const boardId     = selectedTeam?.ecu_serial ? `ECU-${selectedTeam.ecu_serial}` : null
  const frames      = boardId ? (boardData[boardId] ?? []) : []
  const latestFrame = frames.at(-1) ?? null

  const teamAlerts = useMemo(
    () => selectedTeam
      ? alerts.filter((a) => a.ecu_serial === selectedTeam.ecu_serial)
      : [],
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-slate-400 text-sm">Competition not found.</p>
        <button onClick={() => navigate("/")} className="text-ev-cyan text-sm hover:underline">
          ← Back to Competitions
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-8 min-h-0 h-full">

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 order-first">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/")}
              className="text-xs text-slate-400 hover:text-ev-cyan transition-colors mb-1"
            >
              ← Competitions
            </button>
            <h1 className="text-2xl font-bold text-slate-900">{competition.name}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              {competition.events.length === 0 ? (
                <span className="text-xs text-slate-400">No events configured</span>
              ) : (
                competition.events.map((ev) => (
                  <span
                    key={ev.id}
                    className={[
                      "text-xs px-2 py-0.5 rounded-full border capitalize font-medium",
                      EVENT_COLOURS[ev.event_type] ?? "bg-slate-100 text-slate-500 border-slate-200",
                    ].join(" ")}
                  >
                    {ev.event_type}
                  </span>
                ))
              )}
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {selectedTeam
                ? `Viewing · ${selectedTeam.team_name} · ECU ${selectedTeam.ecu_serial ?? "unassigned"}`
                : "Select a team from the panel to view telemetry"}
            </p>
          </div>

          {/* Date range filter */}
          <div className="flex items-end gap-2 shrink-0">
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
            <p className="text-slate-700 font-medium">No teams in this competition</p>
            <p className="text-slate-400 text-sm">Add teams via the Teams page and assign them here</p>
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
                    <AlertCard key={alert.id} alert={alert} teams={competition.teams} />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Team panel ──────────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 flex flex-col gap-4 order-last border-l border-ev-cyan/30 pl-6">
        <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">
          Teams
          <span className="ml-1.5 text-slate-400 normal-case tracking-normal font-normal">
            ({competition.teams.length})
          </span>
        </p>
        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {competition.teams.length === 0 ? (
            <p className="text-slate-600 text-xs">No teams assigned to this competition</p>
          ) : (
            competition.teams.map((team) => (
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
