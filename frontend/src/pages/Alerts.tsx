import { useEffect, useMemo, useState } from "react"
import AlertCard from "../components/ui/AlertCard"
import { useTelemetry } from "../context/TelemetryContext"
import { alertsApi } from "../api/alerts"
import { teamsApi } from "../api/teams"
import { competitionsApi } from "../api/competitions"
import type { Alert, Competition, CompetitionDetail, Team } from "../types"

export default function Alerts() {
  const { alerts: liveAlerts } = useTelemetry()

  const [historicalAlerts, setHistoricalAlerts] = useState<Alert[]>([])
  const [teams, setTeams]                       = useState<Team[]>([])
  const [competitions, setCompetitions]         = useState<CompetitionDetail[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState<string>("all")
  const [selectedTeam, setSelectedTeam]               = useState<string>("all")
  const [loading, setLoading]                         = useState(true)

  useEffect(() => {
    Promise.all([
      teamsApi.list(),
      competitionsApi.list(),
    ])
      .then(async ([teamsRes, competitionsRes]) => {
        setTeams(teamsRes.data)
        const details = await Promise.all(
          competitionsRes.data.map((c: Competition) => competitionsApi.getById(c.id).then(({ data }) => data))
        )
        setCompetitions(details)
      })
      .catch((err) => console.error("Failed to load alerts page data:", err))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: { limit: number; competition_id?: number } = { limit: 1000 }
    if (selectedCompetition !== "all") params.competition_id = parseInt(selectedCompetition)
    alertsApi.list(params)
      .then((res) => setHistoricalAlerts(res.data))
      .catch((err) => console.error("Failed to load alerts:", err))
      .finally(() => setLoading(false))
  }, [selectedCompetition])

  const compEcuSerials = useMemo(() => {
    if (selectedCompetition === "all") return null
    const comp = competitions.find((c) => String(c.id) === selectedCompetition)
    if (!comp) return null
    const serials = new Set<number>()
    comp.teams.forEach((t) => { if (t.ecu_serial) serials.add(t.ecu_serial) })
    return serials
  }, [competitions, selectedCompetition])

  const allAlerts = useMemo<Alert[]>(() => {
    const seen = new Set<number>()
    const live = compEcuSerials
      ? liveAlerts.filter((a) => compEcuSerials.has(a.ecu_serial))
      : liveAlerts
    return [...live, ...historicalAlerts].filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
  }, [liveAlerts, historicalAlerts, compEcuSerials])

  const filteredTeams = useMemo(() => {
    if (selectedCompetition === "all") return teams
    const comp = competitions.find((c) => String(c.id) === selectedCompetition)
    if (!comp) return teams
    const compTeamIds = new Set(comp.teams.map((t) => t.id))
    return teams.filter((t) => compTeamIds.has(t.id))
  }, [teams, competitions, selectedCompetition])

  const visibleAlerts = useMemo(() => {
    if (selectedTeam === "all") return allAlerts
    const team = teams.find((t) => String(t.id) === selectedTeam)
    if (!team) return allAlerts
    if (team.ecu_serial == null) return []
    return allAlerts.filter((a) => a.ecu_serial === team.ecu_serial)
  }, [allAlerts, selectedTeam, teams])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Alerts</h2>
        <p className="text-slate-400 text-sm mt-0.5">Power and current breach incidents across all boards</p>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 uppercase tracking-widest">Competition</label>
          <select
            value={selectedCompetition}
            onChange={(e) => { setSelectedCompetition(e.target.value); setSelectedTeam("all") }}
            className="bg-ev-panel border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan w-48 truncate"
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
            className="bg-ev-panel border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan w-48 truncate"
          >
            <option value="all">All teams</option>
            {filteredTeams.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.team_name}</option>
            ))}
          </select>
        </div>

        {(selectedCompetition !== "all" || selectedTeam !== "all") && (
          <button
            onClick={() => { setSelectedCompetition("all"); setSelectedTeam("all") }}
            className="px-3 py-2 text-sm text-slate-400 border border-ev-border rounded-lg hover:border-ev-cyan hover:text-ev-cyan transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Alert count badge */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">
          {visibleAlerts.length} alert{visibleAlerts.length !== 1 ? "s" : ""}
        </span>
        {visibleAlerts.some((a) => a.ended_at === null) && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
            {visibleAlerts.filter((a) => a.ended_at === null).length} active
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
            <p className="text-slate-600 text-xs mt-1">Power and current breach incidents will appear here</p>
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
