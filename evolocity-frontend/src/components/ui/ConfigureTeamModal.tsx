import { useEffect, useMemo, useState } from "react"
import { ecuApi } from "../../api/ecu"
import { teamsApi } from "../../api/teams"
import type { Team } from "../../types"

interface Props {
  team:    Team
  teams:   Team[]
  onClose: () => void
  onDone:  () => void
}

export default function ConfigureTeamModal({ team, teams, onClose, onDone }: Props) {
  const [allSerials, setAllSerials]   = useState<number[]>([])
  const [selected, setSelected]       = useState(team.ecu_serial ? String(team.ecu_serial) : "")
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    ecuApi.serials().then(({ serials }) => setAllSerials(serials)).catch(console.error)
  }, [])

  // Serials taken by OTHER teams
  const takenByOthers = useMemo(
    () => new Set(teams.filter((t) => t.id !== team.id).map((t) => t.ecu_serial).filter((s): s is number => s !== null)),
    [teams, team.id],
  )

  const availableSerials = useMemo(
    () => allSerials.filter((s) => !takenByOthers.has(s)),
    [allSerials, takenByOthers],
  )

  async function handleSave() {
    setSaving(true)
    try {
      await teamsApi.updateEcu(team.id, selected || null)
      onDone()
    } catch {
      console.error("Failed to update ESP assignment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-ev-panel border border-ev-border rounded-2xl shadow-xl w-full max-w-sm flex flex-col gap-5 p-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold mb-1">Configure Team</p>
            <p className="text-slate-900 font-semibold text-base">{team.team_name}</p>
            <p className="text-slate-400 text-xs">{team.team_id} · {team.vehicle_class} {team.vehicle_type}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>

        {/* ESP assignment */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500">Assign ESP</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
          >
            <option value="">— unassigned —</option>
            {availableSerials.map((s) => (
              <option key={s} value={String(s)}>ESP-{s}</option>
            ))}
          </select>
          {allSerials.length === 0 && (
            <p className="text-xs text-slate-400">No ESPs have connected yet</p>
          )}
          {allSerials.length > 0 && availableSerials.length === 0 && (
            <p className="text-xs text-slate-400">All ESPs are assigned to other teams</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 border border-ev-border rounded-lg hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-ev-cyan rounded-lg hover:bg-ev-blue transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

      </div>
    </div>
  )
}
