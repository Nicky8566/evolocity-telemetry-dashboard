import { useCallback, useEffect, useMemo, useState } from "react"
import { competitionsApi } from "../api/competitions"
import { scoringApi } from "../api/scoring"
import { useTelemetry } from "../context/TelemetryContext"
import type { Competition, CompetitionLeaderboard, EventType, LeaderboardEntry } from "../types"

const EVENT_LABELS: Record<EventType, string> = {
  drag:       "Drag Race",
  gymkhana:   "Gymkhana",
  endurance:  "Endurance",
  efficiency: "Efficiency",
}

type Tab = EventType | "overall"

function formatMetric(entry: LeaderboardEntry) {
  if (entry.raw_metric == null) return "—"
  if (entry.raw_metric_unit === "wh") return `${entry.raw_metric.toFixed(4)} Wh`
  return `${entry.raw_metric.toFixed(2)} s`
}

function formatAdjusted(entry: LeaderboardEntry) {
  if (entry.adjusted == null) return "—"
  if (entry.adjusted_unit === "wh") return `${entry.adjusted.toFixed(4)} Wh`
  return `${entry.adjusted.toFixed(2)} s`
}

export default function Leaderboard() {
  const { leaderboardNudges } = useTelemetry()
  const [competitions, setCompetitions]   = useState<Competition[]>([])
  const [selectedId, setSelectedId]       = useState<number | null>(null)
  const [board, setBoard]                 = useState<CompetitionLeaderboard | null>(null)
  const [tab, setTab]                     = useState<Tab>("overall")
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    competitionsApi.list()
      .then(({ data }) => {
        setCompetitions(data)
        if (data.length > 0 && selectedId == null) setSelectedId(data[0].id)
      })
      .catch((e) => setError(String(e.message ?? e)))
    // Intentionally only on mount — we don't want the list to reload when user picks a competition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(() => {
    if (selectedId == null) return
    setLoading(true)
    scoringApi.getLeaderboard(selectedId)
      .then(({ data }) => setBoard(data))
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }, [selectedId])

  useEffect(() => { refresh() }, [refresh])

  // Live updates: refetch when this competition's nudge counter ticks.
  const nudge = selectedId != null ? (leaderboardNudges[selectedId] ?? 0) : 0
  useEffect(() => {
    if (nudge > 0) refresh()
    // refresh is stable per selectedId; the effect re-runs when nudge changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge])

  // Default to overall when switching competitions. If overall is empty but an event has rows, jump there.
  useEffect(() => {
    if (!board) return
    if (tab === "overall" && board.overall.length === 0) {
      const firstWithRows = board.events.find(e => (board.event_scores[e] ?? []).length > 0)
      if (firstWithRows) setTab(firstWithRows)
    }
  }, [board, tab])

  const tabsAvailable = useMemo<Tab[]>(() => {
    if (!board) return ["overall"]
    return ["overall", ...board.events]
  }, [board])

  return (
    <div className="flex flex-col gap-6 min-h-0 h-full">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leaderboard</h2>
          <p className="text-slate-400 text-sm mt-0.5">Place-based scoring per event (100 → 25 linear). Penalties adjust the raw metric.</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Competition</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value ? parseInt(e.target.value) : null)}
            className="border border-ev-border rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
          >
            {competitions.length === 0 && <option value="">No competitions</option>}
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!board && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-40 select-none">
          <p className="text-5xl">🏆</p>
          <p className="text-slate-700 font-medium">{competitions.length === 0 ? "Create a competition to see the leaderboard" : "Pick a competition above"}</p>
        </div>
      ) : (
        <div className="bg-ev-panel border border-ev-border rounded-xl shadow-sm flex flex-col">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-ev-border overflow-x-auto">
            {tabsAvailable.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  tab === t ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {t === "overall" ? "Overall" : EVENT_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === "overall" ? (
            <OverallTable board={board} />
          ) : (
            <EventTable entries={board?.event_scores[tab] ?? []} />
          )}
        </div>
      )}
    </div>
  )
}

function OverallTable({ board }: { board: CompetitionLeaderboard | null }) {
  if (!board || board.overall.length === 0) {
    return <p className="px-5 py-6 text-sm text-slate-400">No results yet. Stop a run to populate the leaderboard.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400 uppercase tracking-widest">
          <tr>
            <th className="text-left px-5 py-3">#</th>
            <th className="text-left px-5 py-3">Team</th>
            {board.events.map((e) => (
              <th key={e} className="text-right px-5 py-3">{EVENT_LABELS[e]}</th>
            ))}
            <th className="text-right px-5 py-3">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ev-border">
          {board.overall.map((row) => (
            <tr key={row.team_id}>
              <td className="px-5 py-2.5 text-slate-400 font-bold tabular-nums">{row.rank}</td>
              <td className="px-5 py-2.5 text-slate-900 font-medium">{row.team_name}</td>
              {board.events.map((e) => (
                <td key={e} className="px-5 py-2.5 text-right text-slate-700 tabular-nums">
                  {row.per_event[e] != null ? row.per_event[e].toFixed(1) : "—"}
                </td>
              ))}
              <td className="px-5 py-2.5 text-right text-slate-900 font-bold tabular-nums">{row.total.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-5 py-6 text-sm text-slate-400">No attempts recorded for this event yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400 uppercase tracking-widest">
          <tr>
            <th className="text-left px-5 py-3">#</th>
            <th className="text-left px-5 py-3">Team</th>
            <th className="text-right px-5 py-3">Attempts</th>
            <th className="text-right px-5 py-3">Best raw</th>
            <th className="text-right px-5 py-3">Penalty</th>
            <th className="text-right px-5 py-3">Adjusted</th>
            <th className="text-right px-5 py-3">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ev-border">
          {entries.map((row) => (
            <tr key={row.team_id}>
              <td className="px-5 py-2.5 text-slate-400 font-bold tabular-nums">{row.rank ?? "—"}</td>
              <td className="px-5 py-2.5">
                <p className="text-slate-900 font-medium">{row.team_name}</p>
                {row.outcome !== "finished" && (
                  <span className="text-xs text-red-500 font-semibold uppercase">{row.outcome}</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-right text-slate-600 tabular-nums">{row.attempts}</td>
              <td className="px-5 py-2.5 text-right text-slate-700 tabular-nums">{formatMetric(row)}</td>
              <td className="px-5 py-2.5 text-right text-red-500 tabular-nums">
                {row.penalty_seconds > 0 && `+${row.penalty_seconds.toFixed(1)}s`}
                {row.penalty_seconds > 0 && row.penalty_points > 0 && " · "}
                {row.penalty_points > 0 && `−${row.penalty_points.toFixed(0)}pt`}
                {row.penalty_seconds === 0 && row.penalty_points === 0 && "—"}
              </td>
              <td className="px-5 py-2.5 text-right text-slate-900 font-medium tabular-nums">{formatAdjusted(row)}</td>
              <td className="px-5 py-2.5 text-right text-slate-900 font-bold tabular-nums">{row.points.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
