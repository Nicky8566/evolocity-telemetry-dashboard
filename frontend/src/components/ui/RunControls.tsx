import { useCallback, useEffect, useMemo, useState } from "react"
import { runsApi } from "../../api/runs"
import type { CompetitionDetail, EventType, Run, RunOutcome, Team } from "../../types"

interface Props {
  team:        Team
  competition: CompetitionDetail
  /** Notify parent when runs change so it can refresh penalties/leaderboards. */
  onRunsChanged?: () => void
}

const EVENT_LABELS: Record<EventType, string> = {
  drag:       "Drag",
  gymkhana:   "Gymkhana",
  endurance:  "Endurance",
  efficiency: "Efficiency",
}

const OUTCOME_LABEL: Record<Exclude<RunOutcome, "running">, string> = {
  finished: "Finished",
  dnf:      "DNF",
  dq:       "DQ",
  dns:      "DNS",
}

function formatMetric(run: Run) {
  if (run.raw_metric == null) return "—"
  if (run.raw_metric_unit === "wh") return `${run.raw_metric.toFixed(4)} Wh`
  return `${run.raw_metric.toFixed(2)} s`
}

export default function RunControls({ team, competition, onRunsChanged }: Props) {
  const eventTypes  = competition.event_types
  const [event, setEvent] = useState<EventType>(eventTypes[0])
  const [runs, setRuns]   = useState<Run[]>([])
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep event selection in sync if the competition's events change.
  useEffect(() => {
    if (!eventTypes.includes(event)) setEvent(eventTypes[0])
  }, [eventTypes, event])

  const refreshRuns = useCallback(() => {
    runsApi.list({ team_id: team.id, competition_id: competition.id })
      .then(({ data }) => setRuns(data))
      .catch((e) => setError(String(e.message ?? e)))
  }, [team.id, competition.id])

  useEffect(() => { refreshRuns() }, [refreshRuns])

  const runsForEvent = useMemo(() => runs.filter(r => r.event_type === event), [runs, event])
  const activeRun    = useMemo(() => runsForEvent.find(r => r.outcome === "running") ?? null, [runsForEvent])
  const nextAttempt  = (runsForEvent.at(-1)?.attempt_number ?? 0) + 1

  async function startAttempt() {
    setBusy(true)
    setError(null)
    try {
      await runsApi.start(team.id, competition.id, event)
      refreshRuns()
      onRunsChanged?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function stopAttempt(outcome: Exclude<RunOutcome, "running">) {
    if (!activeRun) return
    setBusy(true)
    setError(null)
    try {
      await runsApi.stop(activeRun.id, outcome)
      refreshRuns()
      onRunsChanged?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Run Control</p>
          <p className="text-sm text-slate-500 mt-1">Judges start an attempt, then stop with the appropriate outcome.</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {eventTypes.map((evt) => (
            <button
              key={evt}
              onClick={() => setEvent(evt)}
              disabled={busy}
              className={[
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                event === evt ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {EVENT_LABELS[evt]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {activeRun ? `Attempt ${activeRun.attempt_number} live` : `Attempt ${nextAttempt} ready`}
          </p>
          {activeRun && (
            <p className="text-xs text-slate-400 mt-0.5">Started {new Date(activeRun.started_at).toLocaleTimeString()}</p>
          )}
        </div>

        {activeRun ? (
          <div className="flex gap-2 flex-wrap justify-end">
            {(["finished", "dnf", "dq", "dns"] as const).map((o) => (
              <button
                key={o}
                onClick={() => stopAttempt(o)}
                disabled={busy}
                className={[
                  "px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-40",
                  o === "finished"
                    ? "bg-ev-cyan text-white border-ev-cyan hover:bg-ev-blue"
                    : "border-ev-border text-slate-700 hover:border-red-400 hover:text-red-500",
                ].join(" ")}
              >
                Stop · {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={startAttempt}
            disabled={busy}
            className="px-4 py-2 text-sm bg-ev-orange text-white rounded-lg hover:opacity-90 disabled:opacity-40"
          >
            Start Attempt {nextAttempt}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {runsForEvent.length > 0 && (
        <div className="border-t border-ev-border pt-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">
            Attempts ({EVENT_LABELS[event]})
          </p>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {runsForEvent.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">#{r.attempt_number}</span>
                <span className="tabular-nums text-slate-700">{formatMetric(r)}</span>
                <span className={[
                  "text-xs px-2 py-0.5 rounded-full capitalize",
                  r.outcome === "running"  ? "bg-amber-500/20 text-amber-600" :
                  r.outcome === "finished" ? "bg-emerald-500/20 text-emerald-600" :
                                             "bg-red-500/20 text-red-500",
                ].join(" ")}>{r.outcome}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
