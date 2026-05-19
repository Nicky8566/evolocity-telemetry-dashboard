import { useState } from "react"
import { penaltiesApi } from "../../api/penalties"
import type { Penalty } from "../../types"

interface Props {
  penalties: Penalty[]
  onChange:  () => void
}

const TYPE_LABELS: Record<string, string> = {
  cone_hit:        "Cone hit",
  false_start:     "False start",
  failure_to_stop: "Failure to stop",
  course_cut:      "Course cut",
  dangerous:       "Dangerous driving",
  power_zone:      "Power zone",
  dnf:             "DNF",
  dq:              "DQ",
  dns:             "DNS",
  other:           "Other",
}

export default function PenaltyList({ penalties, onChange }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  function startEdit(p: Penalty) {
    setEditingId(p.id)
    setEditValue(String(p.value))
  }

  async function saveEdit(p: Penalty) {
    const v = Number(editValue)
    if (!Number.isFinite(v) || v < 0) return
    try {
      await penaltiesApi.update(p.id, { value: v })
      setEditingId(null)
      onChange()
    } catch (e) {
      console.error(e)
    }
  }

  async function remove(p: Penalty) {
    if (!window.confirm(`Delete ${TYPE_LABELS[p.penalty_type] ?? p.penalty_type} penalty?`)) return
    try {
      await penaltiesApi.remove(p.id)
      onChange()
    } catch (e) {
      console.error(e)
    }
  }

  if (penalties.length === 0) {
    return <p className="text-slate-500 text-sm">No penalties on this run.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {penalties.map((p) => {
        const editing = editingId === p.id
        return (
          <div key={p.id} className="border border-ev-border rounded-lg px-3 py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{TYPE_LABELS[p.penalty_type] ?? p.penalty_type}</span>
                {p.source === "auto" && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 font-medium">Auto</span>
                )}
              </div>
              {(p.note || p.applied_by) && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {p.applied_by && <span>by {p.applied_by}</span>}
                  {p.applied_by && p.note && <span> · </span>}
                  {p.note}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-20 border border-ev-cyan rounded px-2 py-1 text-sm tabular-nums focus:outline-none"
                  autoFocus
                />
              ) : (
                <span className="tabular-nums text-sm font-semibold text-red-500">
                  +{p.value} {p.unit === "seconds" ? "s" : "pt"}
                </span>
              )}
              {editing ? (
                <>
                  <button onClick={() => saveEdit(p)} className="text-xs text-ev-cyan hover:text-ev-blue">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(p)} className="text-xs text-slate-400 hover:text-slate-700">Edit</button>
                  <button onClick={() => remove(p)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
