import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Alert, Competition, ECUFrame, Team } from "../types"

// Brand colours
const CYAN   = [0,   165, 200] as [number, number, number]
const DARK   = [15,  23,  42]  as [number, number, number]
const MUTED  = [100, 116, 139] as [number, number, number]
const LIGHT  = [241, 245, 249] as [number, number, number]
const WHITE  = [255, 255, 255] as [number, number, number]

function fmt(iso: string) {
  return new Date(iso).toLocaleString()
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

function duration(ms: number | null) {
  if (ms == null) return "ongoing"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function downloadPdf(
  frames:      ECUFrame[],
  team:        Team,
  competition: Competition | null,
  alerts:      Alert[],
) {
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W    = doc.internal.pageSize.getWidth()
  const mar  = 14
  let   y    = 0

  // ── Header banner ────────────────────────────────────────────────────────
  doc.setFillColor(...CYAN)
  doc.rect(0, 0, W, 28, "F")

  doc.setTextColor(...WHITE)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("EVolocity", mar, 11)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text("Post-Race Report", mar, 17)

  doc.setFontSize(8)
  const genLabel = `Generated ${new Date().toLocaleString()}`
  doc.text(genLabel, W - mar - doc.getTextWidth(genLabel), 17)

  if (competition) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    const title = `${competition.name}  ·  ${competition.event_type.charAt(0).toUpperCase() + competition.event_type.slice(1)}`
    doc.text(title, mar, 24)
  }

  y = 36

  // ── Two-column info section ──────────────────────────────────────────────
  const colW = (W - mar * 2 - 8) / 2

  function infoBox(
    x: number,
    startY: number,
    title: string,
    rows: [string, string][],
  ): number {
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, startY, colW, rows.length * 6 + 12, 2, 2, "F")

    doc.setTextColor(...CYAN)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.text(title.toUpperCase(), x + 4, startY + 6)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    let ry = startY + 11
    for (const [label, value] of rows) {
      doc.setTextColor(...MUTED)
      doc.text(label, x + 4, ry)
      doc.setTextColor(...DARK)
      doc.text(value, x + colW - 4 - doc.getTextWidth(value), ry)
      ry += 6
    }
    return ry
  }

  const teamRows: [string, string][] = [
    ["Name",          team.team_name],
    ["Team ID",       team.team_id],
    ["Vehicle Class", team.vehicle_class],
    ["Vehicle Type",  team.vehicle_type],
    ["ECU Serial",    team.ecu_serial != null ? String(team.ecu_serial) : "N/A"],
    ["Power Limit",   team.power_limit != null ? `${team.power_limit}W` : "N/A"],
  ]

  // Run summary values
  let summaryRows: [string, string][] = [["Frames", "0"], ["Duration", "—"], ["Peak Power", "—"], ["Total Energy", "—"]]
  if (frames.length) {
    const first   = frames[0].timestamp
    const last    = frames[frames.length - 1].timestamp
    const durMs   = new Date(last).getTime() - new Date(first).getTime()
    const mins    = Math.floor(durMs / 60000)
    const secs    = Math.floor((durMs % 60000) / 1000)
    const peak    = Math.max(...frames.map((f) => f.avg_power ?? 0))
    const total   = frames.reduce((s, f) => s + (f.avg_energy ?? 0), 0)
    const penalty = alerts.filter((a) => a.type === "penalty").length
    const warning = alerts.filter((a) => a.type === "warning").length
    summaryRows = [
      ["Frames",       frames.length.toLocaleString()],
      ["Duration",     `${mins}m ${secs}s`],
      ["From",         fmt(first)],
      ["To",           fmt(last)],
      ["Peak Power",   `${peak.toFixed(1)}W`],
      ["Total Energy", `${total.toFixed(4)}Wh`],
      ["Penalties",    String(penalty)],
      ["Warnings",     String(warning)],
    ]
  }

  const leftBottom  = infoBox(mar,          y, "Team",        teamRows)
  const rightBottom = infoBox(mar + colW + 8, y, "Run Summary", summaryRows)
  y = Math.max(leftBottom, rightBottom) + 8

  // ── Alerts table ─────────────────────────────────────────────────────────
  doc.setTextColor(...CYAN)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("POWER BREACH EVENTS", mar, y)
  y += 4

  if (alerts.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text("No power breach events recorded.", mar, y + 4)
    y += 12
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: mar, right: mar },
      head: [["Type", "Started", "Ended", "Duration", "Peak Power (W)", "Limit (W)"]],
      body: alerts.map((a) => [
        a.type.charAt(0).toUpperCase() + a.type.slice(1),
        fmt(a.started_at),
        a.ended_at ? fmt(a.ended_at) : "ongoing",
        duration(a.duration_ms),
        a.power_value.toFixed(1),
        a.threshold.toFixed(1),
      ]),
      headStyles:    { fillColor: CYAN, textColor: WHITE, fontSize: 7, fontStyle: "bold" },
      bodyStyles:    { fontSize: 7, textColor: DARK },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles:  { 0: { cellWidth: 18 }, 3: { cellWidth: 20 }, 4: { cellWidth: 28 }, 5: { cellWidth: 22 } },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Telemetry data table ─────────────────────────────────────────────────
  doc.setTextColor(...CYAN)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("TELEMETRY DATA", mar, y)
  y += 4

  if (frames.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text("No telemetry data available.", mar, y + 4)
  } else {
    // Discover columns dynamically — future-proof for new ECUFrame fields
    const knownCols: (keyof ECUFrame)[] = ["timestamp", "avg_voltage", "avg_current", "avg_power", "avg_energy"]
    const extraCols = (Object.keys(frames[0]) as (keyof ECUFrame)[]).filter(
      (k) => !knownCols.includes(k) && k !== "ecu_serial",
    )
    const cols = [...knownCols, ...extraCols]

    const colHeaders: Record<string, string> = {
      timestamp:   "Timestamp",
      avg_voltage: "Voltage (V)",
      avg_current: "Current (A)",
      avg_power:   "Power (W)",
      avg_energy:  "Energy (Wh)",
    }

    autoTable(doc, {
      startY: y,
      margin: { left: mar, right: mar },
      head:   [cols.map((k) => colHeaders[k] ?? String(k))],
      body:   frames.map((f) =>
        cols.map((k) => {
          const v = f[k]
          if (v == null) return ""
          if (k === "timestamp") return fmt(String(v))
          return typeof v === "number" ? v.toFixed(3) : String(v)
        }),
      ),
      headStyles:         { fillColor: CYAN, textColor: WHITE, fontSize: 7, fontStyle: "bold" },
      bodyStyles:         { fontSize: 6.5, textColor: DARK },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles:       { 0: { cellWidth: 38 } },
      didDrawPage: (data) => {
        if (data.pageNumber === 1) return
        // Mini header banner on pages 2+
        doc.setFillColor(...CYAN)
        doc.rect(0, 0, W, 8, "F")
        doc.setTextColor(...WHITE)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(7)
        doc.text("EVolocity Post-Race Report", mar, 5.5)
      },
    })
  }

  // ── Footer on first page ─────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setPage(1)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text("EVolocity Telemetry System", mar, pageH - 6)
  const pages = doc.getNumberOfPages()
  doc.text(`Page 1 of ${pages}`, W - mar - doc.getTextWidth(`Page 1 of ${pages}`), pageH - 6)

  // Footer on remaining pages
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text("EVolocity Telemetry System", mar, pageH - 6)
    doc.text(`Page ${p} of ${pages}`, W - mar - doc.getTextWidth(`Page ${p} of ${pages}`), pageH - 6)
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10)
  const comp = competition ? `_${slugify(competition.name)}` : ""
  doc.save(`evolocity_${slugify(team.team_name)}${comp}_${date}.pdf`)
}
