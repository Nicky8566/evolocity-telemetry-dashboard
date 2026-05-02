import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { competitionsApi } from "../api/competitions"
import { teamsApi } from "../api/teams"
import type { Competition, Team } from "../types"

export default function Competitions() {
  const navigate = useNavigate()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [teams, setTeams]               = useState<Team[]>([])
  const [loading, setLoading]           = useState(true)
  const [newName, setNewName]           = useState("")
  const [creating, setCreating]         = useState(false)

  useEffect(() => {
    Promise.all([competitionsApi.list(), teamsApi.list()])
      .then(([compRes, teamRes]) => {
        setCompetitions(compRes.data)
        setTeams(teamRes.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      await competitionsApi.create(newName.trim())
      setNewName("")
      const res = await competitionsApi.list()
      setCompetitions(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  // Most recently created competition treated as active
  const activeComp = competitions.length > 0 ? competitions[competitions.length - 1] : null
  const pastComps  = competitions.length > 1 ? [...competitions].slice(0, -1).reverse() : []

  return (
    <div className="flex min-h-0 h-full">

      {/* ── Left: leaderboard ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 pr-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competitions</h1>
          <p className="text-slate-400 text-sm mt-0.5">Live leaderboard and competition management</p>
        </div>

        <div className="bg-ev-panel border border-ev-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-ev-border flex items-center justify-between">
            <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Live Leaderboard</p>
            <span className="text-xs text-slate-400">{teams.length} teams</span>
          </div>

          {loading ? (
            <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
          ) : teams.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-slate-400 text-sm">No teams registered yet</p>
            </div>
          ) : (
            <div className="divide-y divide-ev-border">
              {/* Header row */}
              <div className="px-5 py-2 grid grid-cols-[2rem_1fr_auto_auto] gap-4">
                <span className="text-xs text-slate-400 uppercase tracking-widest">#</span>
                <span className="text-xs text-slate-400 uppercase tracking-widest">Team</span>
                <span className="text-xs text-slate-400 uppercase tracking-widest">Class</span>
                <span className="text-xs text-slate-400 uppercase tracking-widest text-right">Score</span>
              </div>
              {teams.map((team, i) => (
                <div key={team.id} className="px-5 py-3 grid grid-cols-[2rem_1fr_auto_auto] gap-4 items-center">
                  <span className="text-sm font-bold text-slate-400 tabular-nums">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{team.team_name}</p>
                    <p className="text-xs text-slate-400">{team.vehicle_type} · ECU {team.ecu_serial ?? "—"}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                    {team.vehicle_class}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-300 tabular-nums">—</p>
                    <p className="text-xs text-slate-400">pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="w-px bg-ev-cyan/30 shrink-0 self-stretch" />

      {/* ── Right: competition list ──────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col gap-4 pl-6">

        {/* Create competition */}
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Competition name…"
            className="flex-1 bg-white border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="px-3 py-2 bg-ev-cyan text-white text-sm rounded-lg disabled:opacity-40 hover:bg-ev-blue transition-colors shrink-0"
          >
            Create
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-xs">Loading…</p>
        ) : (
          <div className="flex flex-col gap-5 overflow-y-auto flex-1">

            {/* Active competition */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Active</p>
              {activeComp ? (
                <CompCard comp={activeComp} active navigate={navigate} />
              ) : (
                <p className="text-slate-500 text-xs">No competitions yet — create one above</p>
              )}
            </div>

            {/* Past competitions */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Past</p>
              {pastComps.length === 0 ? (
                <p className="text-slate-500 text-xs">No past competitions</p>
              ) : (
                pastComps.map((comp) => (
                  <CompCard key={comp.id} comp={comp} active={false} navigate={navigate} />
                ))
              )}
            </div>

          </div>
        )}
      </aside>
    </div>
  )
}

function CompCard({
  comp,
  active,
  navigate,
}: {
  comp: Competition
  active: boolean
  navigate: (path: string) => void
}) {
  return (
    <button
      onClick={() => navigate(`/competitions/${comp.id}`)}
      className={[
        "text-left px-4 py-3 rounded-xl border transition-colors w-full",
        active
          ? "bg-ev-blue/10 border-ev-blue/40 hover:bg-ev-blue/20"
          : "bg-ev-panel border-ev-border hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{comp.name}</p>
        {active && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-600 shrink-0">
            Active
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-2">
        {new Date(comp.created_at).toLocaleDateString()}
      </p>
      <div className="flex gap-1 flex-wrap">
        {(["drag", "gymkhana", "endurance"] as const).map((e) => (
          <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 capitalize">
            {e}
          </span>
        ))}
      </div>
    </button>
  )
}
