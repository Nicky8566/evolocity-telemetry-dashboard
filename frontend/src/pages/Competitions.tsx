import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { competitionsApi } from "../api/competitions"
import CreateCompetitionModal from "../components/ui/CreateCompetitionModal"
import { useTelemetry } from "../context/TelemetryContext"
import type { Competition, CompetitionDetail } from "../types"

const EVENT_COLOURS: Record<string, string> = {
  drag:       "bg-ev-cyan/10 text-ev-cyan border-ev-cyan/30",
  gymkhana:   "bg-purple-500/10 text-purple-400 border-purple-500/30",
  endurance:  "bg-ev-orange/10 text-ev-orange border-ev-orange/30",
  efficiency: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
}

const EVENT_LABELS: Record<string, string> = {
  drag:       "Drag Race",
  gymkhana:   "Gymkhana",
  endurance:  "Endurance",
  efficiency: "Efficiency",
}

export default function Competitions() {
  const navigate = useNavigate()
  const { boardData, alerts } = useTelemetry()

  const [competitions, setCompetitions]   = useState<Competition[]>([])
  const [selected, setSelected]           = useState<CompetitionDetail | null>(null)
  const [showCreate, setShowCreate]       = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sidebarSearch, setSidebarSearch] = useState("")

  function loadCompetitions() {
    competitionsApi.list().then(({ data }) => setCompetitions(data)).catch(console.error)
  }

  function selectCompetition(c: Competition) {
    setLoadingDetail(true)
    competitionsApi.getById(c.id)
      .then(({ data }) => setSelected(data))
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }

  useEffect(() => { loadCompetitions() }, [])

  const teamRows = useMemo(() => {
    if (!selected) return []
    return selected.teams
      .map((team) => {
        const boardId = team.ecu_serial
          ? Object.keys(boardData)
              .filter(k => parseInt(k.split("-")[1]) === team.ecu_serial)
              .sort((a, b) => parseInt(a.split("-")[2] ?? "0") - parseInt(b.split("-")[2] ?? "0"))
              .at(-1) ?? ""
          : ""
        const frames      = boardData[boardId] ?? []
        const latest      = frames.at(-1) ?? null
        const totalEnergy = frames.reduce((s, f) => s + (f.avg_energy ?? 0), 0)
        const teamAlerts  = alerts.filter((a) => a.ecu_serial === team.ecu_serial)
        const penalty     = teamAlerts.some((a) => a.type === "penalty" && a.ended_at === null)
        const warning     = !penalty && teamAlerts.some((a) => a.type === "warning" && a.ended_at === null)
        return { team, latest, totalEnergy, penalty, warning }
      })
      .sort((a, b) => a.totalEnergy - b.totalEnergy)
  }, [selected, boardData, alerts])

  return (
    <div className="flex gap-8 min-h-0 h-full">

      {/* ── Main leaderboard ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 order-first">

        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 max-w-md break-words">
              {selected ? selected.name : "Competitions"}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {selected && selected.event_types.map((evt) => (
                <span key={evt} className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${EVENT_COLOURS[evt] ?? ""}`}>
                  {EVENT_LABELS[evt] ?? evt}
                </span>
              ))}
              <p className="text-slate-400 text-sm">
                {selected
                  ? `${selected.teams.length} team${selected.teams.length !== 1 ? "s" : ""} enrolled`
                  : "Select a competition from the panel"}
              </p>
            </div>
          </div>

          {selected && (
            <button
              onClick={() => navigate(`/competitions/${selected.id}`)}
              className="px-4 py-2 text-sm bg-ev-cyan text-white rounded-lg hover:bg-ev-blue transition-colors"
            >
              Open Dashboard →
            </button>
          )}
        </div>

        {loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Loading…</p>
          </div>
        ) : !selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-40 select-none">
            <p className="text-5xl">🏁</p>
            <p className="text-slate-700 font-medium">No competition selected</p>
            <p className="text-slate-400 text-sm">Pick one from the panel on the right</p>
          </div>
        ) : teamRows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-40 select-none">
            <p className="text-5xl">📋</p>
            <p className="text-slate-700 font-medium">No teams enrolled</p>
            <p className="text-slate-400 text-sm">Open the dashboard to add teams to this competition</p>
          </div>
        ) : (
          <div className="bg-ev-panel border border-ev-border rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-[2rem_1fr_6rem_6rem_6rem_5.5rem_5.5rem] gap-x-6 px-5 py-3 border-b border-ev-border items-center">
              {["#", "Team", "Class", "Live Power", "Energy", "Status", ""].map((h) => (
                <span key={h} className={`text-xs text-slate-400 uppercase tracking-widest font-semibold ${["Class", "Live Power", "Energy", "Status"].includes(h) ? "justify-self-center" : ""}`}>{h}</span>
              ))}
            </div>
            <div className="divide-y divide-ev-border">
              {teamRows.map(({ team, latest, totalEnergy, penalty, warning }, i) => (
                <div
                  key={team.id}
                  className="grid grid-cols-[2rem_1fr_6rem_6rem_6rem_5.5rem_5.5rem] gap-x-6 px-5 py-3.5 items-center"
                >
                  <span className="text-sm font-bold text-slate-400 tabular-nums">{i + 1}</span>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{team.team_name}</p>
                    <p className="text-xs text-slate-400">
                      {team.vehicle_type} · {team.ecu_serial ? `ESP-${team.ecu_serial}` : "No ESP"}
                    </p>
                  </div>

                  <span className="text-xs px-1.5 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-500 capitalize font-medium justify-self-center">
                    {team.vehicle_class}
                  </span>

                  <span className="text-sm tabular-nums font-medium text-slate-700 justify-self-center">
                    {latest?.avg_power != null ? `${latest.avg_power.toFixed(0)} W` : "—"}
                  </span>

                  <span className="text-sm tabular-nums font-medium text-slate-700 justify-self-center">
                    {totalEnergy > 0 ? `${totalEnergy.toFixed(3)} Wh` : "—"}
                  </span>

                  <span className="justify-self-center">
                    {penalty ? (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full border border-red-200 bg-red-100 text-red-600">PENALTY</span>
                    ) : warning ? (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-100 text-amber-600">WARNING</span>
                    ) : (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full border border-green-200 bg-green-100 text-green-700">OK</span>
                    )}
                  </span>

                  <button
                    onClick={() => navigate(`/competitions/${selected.id}`)}
                    className="text-xs text-ev-cyan hover:text-ev-blue transition-colors whitespace-nowrap"
                  >
                    Dashboard →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Competition sidebar ──────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 flex flex-col gap-4 order-last border-l border-ev-cyan/30 pl-6 sticky top-[5.75rem] self-start h-[calc(100vh-7.75rem)]">
        <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Competitions</p>
        <input
          type="text"
          placeholder="Search…"
          value={sidebarSearch}
          onChange={(e) => setSidebarSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-ev-border text-sm text-slate-700 bg-white focus:outline-none focus:border-ev-cyan shrink-0"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="text-left px-3 py-2.5 rounded-lg border border-dashed border-ev-cyan/40 text-ev-cyan text-sm hover:bg-ev-cyan/5 transition-colors shrink-0"
        >
          + New Competition
        </button>
        <div className="scrollbar-hover flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">

          {competitions.length === 0 ? (
            <p className="text-slate-500 text-xs px-3 pt-1">No competitions yet</p>
          ) : (
            competitions.filter((comp) => comp.name.toLowerCase().includes(sidebarSearch.toLowerCase())).map((comp) => (
              <button
                key={comp.id}
                onClick={() => selectCompetition(comp)}
                className={[
                  "text-left px-3 py-2.5 rounded-lg border transition-colors",
                  selected?.id === comp.id
                    ? "bg-ev-orange/10 border-ev-orange/40"
                    : "border-transparent hover:bg-slate-100",
                ].join(" ")}
              >
                <p className="text-sm font-medium leading-tight text-slate-900 truncate">{comp.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {comp.event_types.map((e) => EVENT_LABELS[e] ?? e).join(" · ")}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      {showCreate && (
        <CreateCompetitionModal
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); loadCompetitions() }}
        />
      )}
    </div>
  )
}
