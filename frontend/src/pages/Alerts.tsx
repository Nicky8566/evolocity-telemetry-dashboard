import { useEffect, useMemo, useState } from "react"
import AlertCard from "../components/ui/AlertCard"
import { useTelemetry } from "../context/TelemetryContext"
import { alertsApi } from "../api/alerts"
import { teamsApi } from "../api/teams"
import { competitionsApi } from "../api/competitions"
import type { Alert, Competition, Team } from "../types"

export default function Alerts() {
  const { alerts: liveAlerts } = useTelemetry()

  const [historicalAlerts, setHistoricalAlerts] = useState<Alert[]>([])
  const [teams, setTeams]                       = useState<Team[]>([])
  const [competitions, setCompetitions]         = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState<string>("all")
  const [selectedTeam, setSelectedTeam]               = useState<string>("all")
  const [loading, setLoading]                         = useState(true)

  // Fetch historical alerts, teams and competitions on mount
  useEffect(() => {
    Promise.all([
      alertsApi.list({ limit: 200 }),
      teamsApi.list(),
      competitionsApi.list(),
    ])
      .then(([alertsRes, teamsRes, competitionsRes]) => {
        setHistoricalAlerts(alertsRes.data)
        setTeams(teamsRes.data)
        setCompetitions(competitionsRes.data)
      })
      .catch((err) => console.error("Failed to load alerts page data:", err))
      .finally(() => setLoading(false))
  }, [])

  // Merge live alerts with historical, deduplicate by id, keep newest first
  const allAlerts = useMemo<Alert[]>(() => {
    const seen = new Set<number>()
    return [...liveAlerts, ...historicalAlerts].filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
  }, [liveAlerts, historicalAlerts])

  // Teams visible under the selected competition
  // (competition_id on team comes in Phase 3 — for now show all teams)
  const filteredTeams = useMemo(
    () => (selectedCompetition === "all" ? teams : teams),
    [teams, selectedCompetition],
  )

  // Filter alerts by selected team → resolve via ecu_serial
  const visibleAlerts = useMemo(() => {
    if (selectedTeam === "all") return allAlerts
    const team = teams.find((t) => String(t.id) === selectedTeam)
    if (!team) return allAlerts
    return allAlerts.filter((a) => a.ecu_serial === team.ecu_serial)
  }, [allAlerts, selectedTeam, teams])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Alerts</h2>
        <p className="text-slate-400 text-sm mt-0.5">Power breach incidents across all boards</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 uppercase tracking-widest">Competition</label>
          <select
            value={selectedCompetition}
            onChange={(e) => { setSelectedCompetition(e.target.value); setSelectedTeam("all") }}
            className="bg-ev-panel border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
          >
            <option value="all">All competitions</option>
            {competitions.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 uppercase tracking-widest">Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-ev-panel border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
          >
            <option value="all">All teams</option>
            {filteredTeams.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.team_name}</option>
            ))}
          </select>
        </div>

        {(selectedCompetition !== "all" || selectedTeam !== "all") && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-transparent uppercase tracking-widest">Clear</label>
            <button
              onClick={() => { setSelectedCompetition("all"); setSelectedTeam("all") }}
              className="px-3 py-2 text-sm text-slate-500 border border-ev-border rounded-lg hover:text-slate-900 hover:border-slate-400 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Alert count badge */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">
          {visibleAlerts.length} alert{visibleAlerts.length !== 1 ? "s" : ""}
        </span>
        {liveAlerts.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
            {liveAlerts.length} live
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading alerts...</p>
        ) : visibleAlerts.length === 0 ? (
          <div className="bg-ev-panel border border-ev-border rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">No alerts found</p>
            <p className="text-slate-600 text-xs mt-1">Power breach incidents will appear here</p>
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} teams={teams} />
          ))
        )}
      </div>
    </div>
  )
}
