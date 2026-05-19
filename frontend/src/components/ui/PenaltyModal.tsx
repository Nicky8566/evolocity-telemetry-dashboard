import { useState } from "react"
import { penaltiesApi } from "../../api/penalties"
import type { EventType, PenaltyType, Run } from "../../types"

interface Props {
  run:     Run
  onClose: () => void
  onDone:  () => void
}

interface PenaltyOption {
  value: PenaltyType
  label: string
  defaultValue: number
  unit: "seconds" | "points"
  events: EventType[] | "all"
  hint?: string
}

// Sourced from rules sections RE.2.2 / RE.3.2 / RE.4.4 / RE.5.1.
const PENALTY_OPTIONS: PenaltyOption[] = [
  { value: "cone_hit",        label: "Cone hit",          defaultValue: 5,  unit: "seconds", events: ["gymkhana"],            hint: "RE.3.2.b — 5s per cone hit." },
  { value: "false_start",     label: "False start",       defaultValue: 0,  unit: "points",  events: ["drag", "gymkhana", "endurance"], hint: "RE.2.2.e / RE.3.2.c: DQ; RE.4.4.b: 10pt in Endurance." },
  { value: "failure_to_stop", label: "Failure to stop",   defaultValue: 6,  unit: "seconds", events: ["drag"],                hint: "RE.2.2.d — 6s if not stopped in deceleration zone." },
  { value: "course_cut",      label: "Course cut",        defaultValue: 0,  unit: "points",  events: ["endurance"],           hint: "RE.4.4.c — DQ." },
  { value: "dangerous",       label: "Dangerous driving", defaultValue: 0,  unit: "points",  events: ["endurance"],           hint: "RE.4.2.a — DQ." },
  { value: "power_zone",      label: "Power zone breach", defaultValue: 5,  unit: "seconds", events: ["efficiency"],          hint: "RE.5.1.b — usually auto-applied from telemetry." },
  { value: "other",           label: "Other",             defaultValue: 0,  unit: "seconds", events: "all" },
]

function optionsForEvent(event: EventType) {
  return PENALTY_OPTIONS.filter(o => o.events === "all" || o.events.includes(event))
}

export default function PenaltyModal({ run, onClose, onDone }: Props) {
  const available  = optionsForEvent(run.event_type)
  const [type, setType]               = useState<PenaltyType>(available[0]?.value ?? "other")
  const current                       = available.find(o => o.value === type) ?? available[0]
  const [value, setValue]             = useState<string>(String(current?.defaultValue ?? 0))
  const [unit, setUnit]               = useState<"seconds" | "points">(current?.unit ?? "seconds")
  const [note, setNote]               = useState("")
  const [appliedBy, setAppliedBy]     = useState("")
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  function pickType(next: PenaltyType) {
    setType(next)
    const opt = PENALTY_OPTIONS.find(o => o.value === next)
    if (opt) { setValue(String(opt.defaultValue)); setUnit(opt.unit) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError("Value must be a non-negative number")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await penaltiesApi.create({
        run_id:       run.id,
        penalty_type: type,
        value:        numericValue,
        unit,
        note:         note.trim() || undefined,
        applied_by:   appliedBy.trim() || undefined,
      })
      onDone()
    } catch (e2: unknown) {
      const msg = e2 instanceof Error ? e2.message : String(e2)
      setError(msg)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Apply Penalty</h2>
            <p className="text-xs text-slate-500 mt-0.5">Run #{run.id} · {run.event_type} · attempt {run.attempt_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-500">Penalty type</label>
            <select
              value={type}
              onChange={(e) => pickType(e.target.value as PenaltyType)}
              className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
            >
              {available.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {current?.hint && <p className="text-xs text-slate-400">{current.hint}</p>}
          </div>

          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500">Value</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as "seconds" | "points")}
                className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
              >
                <option value="seconds">seconds</option>
                <option value="points">points</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-500">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 2nd cone at the chicane"
              className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-500">Applied by (optional)</label>
            <input
              value={appliedBy}
              onChange={(e) => setAppliedBy(e.target.value)}
              placeholder="Judge name"
              className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-ev-border rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg disabled:opacity-40 hover:bg-red-600 transition-colors">
              {saving ? "Saving…" : "Apply penalty"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
