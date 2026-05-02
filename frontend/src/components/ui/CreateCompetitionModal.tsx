import { useState } from "react"
import { competitionsApi } from "../../api/competitions"

interface Props {
  onClose: () => void
  onDone:  () => void
}

const EVENT_TYPES = [
  { value: "drag",      label: "Drag Race",             desc: "Straight-line acceleration sprint" },
  { value: "gymkhana",  label: "Gymkhana",              desc: "Agility course, tight manoeuvres" },
  { value: "endurance", label: "Endurance & Efficiency", desc: "Long-run energy consumption" },
] as const

export default function CreateCompetitionModal({ onClose, onDone }: Props) {
  const [name, setName]           = useState("")
  const [eventType, setEventType] = useState<string>("")
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !eventType || saving) return
    setSaving(true)
    setError(null)
    try {
      await competitionsApi.create(name.trim(), eventType)
      onDone()
    } catch {
      setError("Failed to create competition")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Competition</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-500">Competition name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EV Race 2025"
              className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-500">Event type</label>
            <div className="flex flex-col gap-2">
              {EVENT_TYPES.map((et) => (
                <button
                  key={et.value}
                  type="button"
                  onClick={() => setEventType(et.value)}
                  className={[
                    "text-left px-3 py-2.5 rounded-lg border transition-colors",
                    eventType === et.value
                      ? "bg-ev-cyan/10 border-ev-cyan text-ev-cyan"
                      : "border-ev-border text-slate-700 hover:border-slate-300",
                  ].join(" ")}
                >
                  <p className="text-sm font-medium">{et.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{et.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-ev-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !eventType || saving}
              className="px-4 py-2 text-sm bg-ev-cyan text-white rounded-lg disabled:opacity-40 hover:bg-ev-blue transition-colors"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
