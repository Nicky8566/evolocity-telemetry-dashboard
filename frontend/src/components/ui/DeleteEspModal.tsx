import { useState } from "react"
import type { Team } from "../../types"

interface EcuDevice {
  ecu_serial:       number
  last_recorded_at: string
  total_frames:     number
}

interface CompetitionAssignment {
  competition_id:   number
  competition_name: string
  event_type:       string
}

interface Props {
  device:       EcuDevice
  assignedTeam: Team | null
  competitions: CompetitionAssignment[]
  onCancel:     () => void
  onConfirm:    (exportCsv: boolean, exportPdf: boolean) => Promise<void>
}

function minsAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function DeleteEspModal({ device, assignedTeam, competitions, onCancel, onConfirm }: Props) {
  const [exportCsv, setExportCsv] = useState(false)
  const [exportPdf, setExportPdf] = useState(false)
  const [busy, setBusy]           = useState(false)

  const mins        = minsAgo(device.last_recorded_at)
  const recentlySeen = mins < 10

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm(exportCsv, exportPdf)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col gap-5 p-6">

        {/* Title */}
        <div>
          <h2 className="text-lg font-bold text-slate-900">Delete ESP-{device.ecu_serial}?</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            This will permanently delete all telemetry data for this ESP. This cannot be undone.
          </p>
        </div>

        {/* Warnings */}
        <div className="flex flex-col gap-2">
          {recentlySeen && (
            <div className="flex gap-2 items-start bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5 text-sm text-yellow-800">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>
                This ESP was last seen <strong>{mins === 0 ? "less than a minute" : `${mins} minute${mins === 1 ? "" : "s"}`} ago</strong> — it may still be active or reconnect soon.
              </span>
            </div>
          )}

          {assignedTeam && (
            <div className="flex gap-2 items-start bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-sm text-orange-800">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>
                This ESP is assigned to <strong>{assignedTeam.team_name}</strong>
                {competitions.length === 1 && <> in <strong>{competitions[0].competition_name}</strong></>}
                {competitions.length > 1 && <> in <strong>{competitions.map((c) => c.competition_name).join(", ")}</strong></>}.
                Deleting it will unassign it and stop live telemetry for that team.
              </span>
            </div>
          )}

          <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
            <span className="shrink-0 mt-0.5">🗑</span>
            <span>
              <strong>{device.total_frames.toLocaleString()} frames</strong> of telemetry data will be permanently deleted.
            </span>
          </div>
        </div>

        {/* Export options */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Export before deleting</p>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportCsv}
              onChange={(e) => setExportCsv(e.target.checked)}
              className="accent-ev-cyan w-4 h-4"
            />
            <span className="text-sm text-slate-700">Download CSV</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportPdf}
              onChange={(e) => setExportPdf(e.target.checked)}
              className="accent-ev-cyan w-4 h-4"
            />
            <span className="text-sm text-slate-700">Download PDF report</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 rounded-lg border border-ev-border text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {busy
              ? exportCsv || exportPdf ? "Exporting & deleting…" : "Deleting…"
              : "Delete ESP"}
          </button>
        </div>
      </div>
    </div>
  )
}
