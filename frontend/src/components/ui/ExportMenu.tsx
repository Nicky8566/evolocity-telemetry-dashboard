import { useState } from "react"
import { alertsApi } from "../../api/alerts"
import type { Alert, Competition, ECUFrame, Team } from "../../types"
import { downloadCsv } from "../../utils/exportCsv"
import { downloadPdf } from "../../utils/exportPdf"

interface Props {
  frames:      ECUFrame[]
  team:        Team
  competition: Competition | null
}

export default function ExportMenu({ frames, team, competition }: Props) {
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)

  async function fetchAlerts(): Promise<Alert[]> {
    try {
      const { data } = await alertsApi.list({
        ecu_serial: team.ecu_serial ?? undefined,
        limit:      1000,
      })
      return data
    } catch {
      return []
    }
  }

  async function handleCsv() {
    if (exporting || frames.length === 0) return
    setExporting("csv")
    try {
      const alerts = await fetchAlerts()
      downloadCsv(frames, team, competition, alerts)
    } finally {
      setExporting(null)
    }
  }

  async function handlePdf() {
    if (exporting || frames.length === 0) return
    setExporting("pdf")
    try {
      const alerts = await fetchAlerts()
      downloadPdf(frames, team, competition, alerts)
    } finally {
      setExporting(null)
    }
  }

  const disabled = frames.length === 0

  const btnBase =
    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 mr-1">Export</span>

      <button
        onClick={handleCsv}
        disabled={disabled || exporting !== null}
        className={`${btnBase} border-ev-border text-slate-600 hover:border-ev-cyan hover:text-ev-cyan`}
        title="Download telemetry data as CSV"
      >
        {exporting === "csv" ? (
          <span className="w-3 h-3 rounded-full border-2 border-ev-cyan border-t-transparent animate-spin" />
        ) : (
          <span>↓</span>
        )}
        CSV
      </button>

      <button
        onClick={handlePdf}
        disabled={disabled || exporting !== null}
        className={`${btnBase} border-ev-border text-slate-600 hover:border-ev-cyan hover:text-ev-cyan`}
        title="Download formatted PDF race report"
      >
        {exporting === "pdf" ? (
          <span className="w-3 h-3 rounded-full border-2 border-ev-cyan border-t-transparent animate-spin" />
        ) : (
          <span>↓</span>
        )}
        PDF
      </button>
    </div>
  )
}
