import { useCallback, useEffect, useMemo, useState } from "react"
import { penaltiesApi } from "../../api/penalties"
import { runsApi } from "../../api/runs"
import { useTelemetry } from "../../context/TelemetryContext"
import type { CompetitionDetail, EventType, Penalty, Run, RunOutcome, Team } from "../../types"
import PenaltyList from "./PenaltyList"
import PenaltyModal from "./PenaltyModal"

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

// Same liveness rule the team sidebar uses (Dashboard.tsx): non-zero voltage in the last 5s.
const LIVE_WINDOW_MS = 5000

export default function RunControls({ team, competition, onRunsChanged }: Props) {
  const { runsVersion, penaltiesVersion, boardData } = useTelemetry()
  const eventTypes  = competition.event_types
  const [event, setEvent] = useState<EventType>(eventTypes[0])
  const [runs, setRuns]   = useState<Run[]>([])
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow]     = useState(() => Date.now())

  // Tick once per second so the live-frame staleness check re-evaluates without telemetry.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const ecuLive = useMemo(() => {
    if (team.ecu_serial == null) return false
    const frames = boardData[`ECU-${team.ecu_serial}`] ?? []
    const last = frames.at(-1)
    if (!last) return false
    return last.avg_voltage > 0 && now - new Date(last.timestamp).getTime() < LIVE_WINDOW_MS
  }, [boardData, team.ecu_serial, now])

  const noEcu        = team.ecu_serial == null
  const startBlocked = noEcu || !ecuLive
  const blockedReason = noEcu
    ? "Assign an ECU to this team before starting a run."
    : `ECU ${team.ecu_serial} is offline. Wait for telemetry before starting a run.`

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

  // Live updates: refetch when WS reports a run/penalty change anywhere.
  useEffect(() => {
    if (runsVersion > 0) refreshRuns()
  }, [runsVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const runsForEvent = useMemo(() => runs.filter(r => r.event_type === event), [runs, event])
  const activeRun    = useMemo(() => runsForEvent.find(r => r.outcome === "running") ?? null, [runsForEvent])
  const latestRun    = activeRun ?? runsForEvent.at(-1) ?? null
  const nextAttempt  = (runsForEvent.at(-1)?.attempt_number ?? 0) + 1

  // Which attempt the Penalties section operates on. Defaults to the latest run,
  // but the user can click any attempt in the list to switch.
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const selectedRun = useMemo(
    () => runsForEvent.find(r => r.id === selectedRunId) ?? latestRun,
    [runsForEvent, selectedRunId, latestRun],
  )

  // When the event tab changes or new runs arrive, reset selection so the
  // user sees penalties for whatever is most relevant (active or latest).
  useEffect(() => { setSelectedRunId(null) }, [event, team.id, competition.id])

  const [penalties, setPenalties]     = useState<Penalty[]>([])
  const [showPenalty, setShowPenalty] = useState(false)

  const refreshPenalties = useCallback(() => {
    if (!selectedRun) { setPenalties([]); return }
    penaltiesApi.listByRun(selectedRun.id)
      .then(({ data }) => setPenalties(data))
      .catch(console.error)
  }, [selectedRun])

  useEffect(() => { refreshPenalties() }, [refreshPenalties])

  // Refetch this run's penalties when the WS reports a penalty change.
  useEffect(() => {
    if (penaltiesVersion > 0) refreshPenalties()
  }, [penaltiesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-4 shadow-sm h-96 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Run Control</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1">
            {eventTypes.map((evt) => (
              <button
                key={evt}
                onClick={() => setEvent(evt)}
                disabled={busy}
                className={[
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  event === evt ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {EVENT_LABELS[evt]}
              </button>
            ))}
          </div>
          {!activeRun && (
            <button
              onClick={startAttempt}
              disabled={busy || startBlocked}
              title={startBlocked ? blockedReason : undefined}
              className="px-3 py-1.5 text-xs font-medium bg-ev-orange text-white rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Attempt {nextAttempt}
            </button>
          )}
        </div>
      </div>

      {activeRun && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Attempt {activeRun.attempt_number} live · started {new Date(activeRun.started_at).toLocaleTimeString()}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(["finished", "dnf", "dq", "dns"] as const).map((o) => (
              <button
                key={o}
                onClick={() => stopAttempt(o)}
                disabled={busy}
                title={`Stop run · ${OUTCOME_LABEL[o]}`}
                className={[
                  "px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-40",
                  o === "finished"
                    ? "bg-ev-cyan text-white border-ev-cyan hover:bg-ev-blue"
                    : "border-ev-border text-slate-700 hover:border-red-400 hover:text-red-500",
                ].join(" ")}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!activeRun && noEcu && (
        <p className="text-xs text-amber-600">This team has no ECU assigned. Assign one in <span className="font-semibold">Teams</span> before starting a run.</p>
      )}
      {!activeRun && !noEcu && !ecuLive && (
        <p className="text-xs text-amber-600">ECU {team.ecu_serial} is offline. Wait for telemetry before starting a run.</p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Attempts + Penalties sit side by side, each with its own scrollable region,
          so the layout stays stable from zero to many attempts. */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
        <section className="border-t border-ev-border pt-3 flex flex-col min-h-0">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2 shrink-0">
            Attempts
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
            {runsForEvent.length === 0 ? (
              <p className="text-xs text-slate-400">No attempts yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {runsForEvent.map((r) => {
                  const isSelected = selectedRun?.id === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRunId(r.id)}
                      className={[
                        "flex items-center justify-between text-sm px-2 py-1 rounded-md border transition-colors text-left",
                        isSelected
                          ? "bg-ev-cyan/10 border-ev-cyan/40"
                          : "border-transparent hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span className="text-slate-600 font-medium">#{r.attempt_number}</span>
                      <span className="tabular-nums text-slate-700">{formatMetric(r)}</span>
                      <span className={[
                        "text-xs px-2 py-0.5 rounded-full capitalize",
                        r.outcome === "running"  ? "bg-amber-500/20 text-amber-600" :
                        r.outcome === "finished" ? "bg-emerald-500/20 text-emerald-600" :
                                                   "bg-red-500/20 text-red-500",
                      ].join(" ")}>{r.outcome}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-ev-border pt-3 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
              Penalties
            </p>
            <button
              onClick={() => setShowPenalty(true)}
              disabled={!selectedRun}
              className="text-xs px-2.5 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Penalty
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
            {!selectedRun ? (
              <p className="text-xs text-slate-400">Start an attempt to apply penalties.</p>
            ) : (
              <PenaltyList penalties={penalties} onChange={() => { refreshPenalties(); onRunsChanged?.() }} />
            )}
          </div>
        </section>
      </div>

      {showPenalty && selectedRun && (
        <PenaltyModal
          run={selectedRun}
          onClose={() => setShowPenalty(false)}
          onDone={() => { setShowPenalty(false); refreshPenalties(); onRunsChanged?.() }}
        />
      )}
    </div>
  )
}
