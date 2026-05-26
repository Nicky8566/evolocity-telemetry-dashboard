import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { alertsApi } from "../api/alerts"
import { competitionsApi } from "../api/competitions"
import { ecuApi } from "../api/ecu"
import { teamsApi } from "../api/teams"
import DeleteEspModal from "../components/ui/DeleteEspModal"
import { useTelemetry } from "../context/TelemetryContext"
import type { Team } from "../types"
import { formatEspLabel } from "../types"
import { downloadCsv } from "../utils/exportCsv"
import { downloadPdf } from "../utils/exportPdf"

interface EcuDevice {
  ecu_serial:       number
  last_recorded_at: string
  total_frames:     number
}

interface CompetitionAssignment {
  team_id:          number
  competition_id:   number
  competition_name: string
  event_type:       string
  event_types:      string[]
}

type Status = "live" | "offline" | "no-session"

const STATUS_ORDER: Record<Status, number> = { live: 0, offline: 1, "no-session": 2 }

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  live:         { label: "Live",            className: "bg-green-100 text-green-700 border-green-200" },
  offline:      { label: "Offline",         className: "bg-red-100 text-red-500 border-red-200" },
  "no-session": { label: "No session data", className: "bg-slate-100 text-slate-500 border-slate-200" },
}

const STATUS_DOT: Record<Status, string> = {
  live:         "bg-green-400 animate-pulse",
  offline:      "bg-red-400",
  "no-session": "bg-slate-300",
}

const EVENT_COLOURS: Record<string, string> = {
  drag:      "bg-ev-cyan/10 text-ev-cyan border-ev-cyan/30",
  gymkhana:  "bg-purple-500/10 text-purple-400 border-purple-500/30",
  endurance: "bg-ev-orange/10 text-ev-orange border-ev-orange/30",
  efficiency: "bg-green-500/10 text-green-500 border-green-500/30",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 5000)     return "just now"
  if (diff < 60000)    return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function EcuMonitor() {
  const { boardData }                         = useTelemetry()
  const [devices, setDevices]                 = useState<EcuDevice[]>([])
  const [teams, setTeams]                     = useState<Team[]>([])
  const [competitionMap, setCompetitionMap]   = useState<Map<number, CompetitionAssignment[]>>(new Map())
  const [loading, setLoading]                 = useState(true)
  const [assigning, setAssigning]             = useState<number | null>(null)
  const [exportingEsp, setExportingEsp]       = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget]       = useState<EcuDevice | null>(null)
  const [confirmUnassign, setConfirmUnassign] = useState<{ ecu_serial: number; teamName: string } | null>(null)
  const [searchQuery, setSearchQuery]         = useState("")
  const [sortBy, setSortBy]                   = useState<"serial" | "lastSeen" | "team">("serial")
  const [autoRefresh, setAutoRefresh]         = useState(false)
  const autoRefreshRef                        = useRef<number | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      ecuApi.status(),
      teamsApi.list(),
      competitionsApi.teamAssignments().catch(() => ({ assignments: [] })),
    ])
      .then(([{ devices: devs }, { data: teamList }, { assignments }]) => {
        setDevices(devs)
        setTeams(teamList)
        const map = new Map<number, CompetitionAssignment[]>()
        assignments.forEach((a) => map.set(a.team_id, [...(map.get(a.team_id) ?? []), a]))
        setCompetitionMap(map)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Auto-refresh: re-fetch DB data every 15s when enabled
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = window.setInterval(load, 15000)
    } else {
      if (autoRefreshRef.current !== null) window.clearInterval(autoRefreshRef.current)
    }
    return () => { if (autoRefreshRef.current !== null) window.clearInterval(autoRefreshRef.current) }
  }, [autoRefresh])

  // Live telemetry snapshot per serial — boardId format "ECU-{serial}".
  const liveData = useMemo(() => {
    const map: Record<number, { last: (typeof boardData)[string][number]; isLive: boolean }> = {}
    for (const [boardId, frames] of Object.entries(boardData)) {
      const serial = parseInt(boardId.split("-")[1] ?? "")
      if (isNaN(serial)) continue
      const last = frames.at(-1)
      if (!last) continue
      const isLive = last.avg_voltage > 0 && Date.now() - (last.received_at_ms ?? 0) < 5000
      map[serial] = { last, isLive }
    }
    return map
  }, [boardData])

  function getStatus(serial: number): Status {
    const d = liveData[serial]
    if (!d) return "no-session"
    return d.isLive ? "live" : "offline"
  }

  async function handleAssign(ecuSerial: number, newTeamId: number | null) {
    setAssigning(ecuSerial)
    try {
      const currentHolder = teams.find((t) => t.ecu_serial === ecuSerial)
      if (currentHolder) await teamsApi.updateEcu(currentHolder.id, null)
      if (newTeamId !== null) await teamsApi.updateEcu(newTeamId, String(ecuSerial))
      const [{ data: updatedTeams }, { assignments }] = await Promise.all([
        teamsApi.list(),
        competitionsApi.teamAssignments(),
      ])
      setTeams(updatedTeams)
      const map = new Map<number, CompetitionAssignment[]>()
      assignments.forEach((a) => map.set(a.team_id, [...(map.get(a.team_id) ?? []), a]))
      setCompetitionMap(map)
    } catch (err) {
      console.error(err)
    } finally {
      setAssigning(null)
    }
  }

  async function handleExport(ecuSerial: number, format: "csv" | "pdf") {
    setExportingEsp(ecuSerial)
    try {
      const assignedTeam = teams.find((t) => t.ecu_serial === ecuSerial) ?? null
      const compAssign   = assignedTeam ? (competitionMap.get(assignedTeam.id) ?? [])[0] ?? null : null
      const eventType    = compAssign?.event_type as "drag" | "gymkhana" | "endurance" | "efficiency"
      const competition  = compAssign
        ? { id: compAssign.competition_id, name: compAssign.competition_name, event_type: eventType, event_types: [eventType], created_at: "" }
        : null

      const [{ data: frames }, { data: alerts }] = await Promise.all([
        ecuApi.history({ ecu_serial: ecuSerial }),
        alertsApi.list({ ecu_serial: ecuSerial, limit: 1000 }),
      ])

      if (format === "csv") downloadCsv(frames, assignedTeam, competition, alerts)
      else                  downloadPdf(frames, assignedTeam, competition, alerts)
    } catch (err) {
      console.error(err)
    } finally {
      setExportingEsp(null)
    }
  }

  async function handleDelete(exportCsv: boolean, exportPdf: boolean) {
    if (!deleteTarget) return
    const { ecu_serial } = deleteTarget
    const assignedTeam   = teams.find((t) => t.ecu_serial === ecu_serial) ?? null
    const compAssign     = assignedTeam ? (competitionMap.get(assignedTeam.id) ?? [])[0] ?? null : null
    const eventType      = compAssign?.event_type as "drag" | "gymkhana" | "endurance" | "efficiency"
    const competition    = compAssign
      ? { id: compAssign.competition_id, name: compAssign.competition_name, event_type: eventType, event_types: [eventType], created_at: "" }
      : null

    if (exportCsv || exportPdf) {
      const [{ data: frames }, { data: alerts }] = await Promise.all([
        ecuApi.history({ ecu_serial }),
        alertsApi.list({ ecu_serial, limit: 1000 }),
      ])
      if (exportCsv) downloadCsv(frames, assignedTeam, competition, alerts)
      if (exportPdf) downloadPdf(frames, assignedTeam, competition, alerts)
    }

    await ecuApi.deleteEcu(ecu_serial)
    setDeleteTarget(null)
    load()
  }

  // Filter by search, then sort: live → offline → no-session first, then by chosen criterion
  const displayDevices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? devices.filter((d) => String(d.ecu_serial).includes(q))
      : devices
    return [...filtered].sort((a, b) => {
      const statusDiff = STATUS_ORDER[getStatus(a.ecu_serial)] - STATUS_ORDER[getStatus(b.ecu_serial)]
      if (statusDiff !== 0) return statusDiff
      switch (sortBy) {
        case "lastSeen": {
          const aT = liveData[a.ecu_serial]?.last?.timestamp ?? a.last_recorded_at
          const bT = liveData[b.ecu_serial]?.last?.timestamp ?? b.last_recorded_at
          return new Date(bT).getTime() - new Date(aT).getTime()
        }
        case "team": {
          const aName = teams.find((t) => t.ecu_serial === a.ecu_serial)?.team_name ?? "￿"
          const bName = teams.find((t) => t.ecu_serial === b.ecu_serial)?.team_name ?? "￿"
          return aName.localeCompare(bName)
        }
        default:
          return a.ecu_serial - b.ecu_serial
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, searchQuery, liveData, sortBy, teams])

  const liveCount       = Object.values(liveData).filter((d) => d.isLive).length
  const unassignedCount = devices.filter((d) => !teams.some((t) => t.ecu_serial === d.ecu_serial)).length

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ESPs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Monitor connected ESP32 boards and manage team assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={[
              "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
              autoRefresh
                ? "border-ev-cyan text-ev-cyan bg-ev-cyan/5"
                : "border-ev-border text-slate-500 hover:border-ev-cyan hover:text-ev-cyan",
            ].join(" ")}
            title="Refreshes the ESP list and team assignments every 15 seconds — useful during event setup when new boards may come online"
          >
            {autoRefresh ? "⟳ Auto-refresh on" : "⟳ Auto-refresh off"}
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg border border-ev-border text-xs text-slate-500 hover:border-ev-cyan hover:text-ev-cyan transition-colors"
            title="Re-fetch ESP list and team assignments from the database"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Summary + search row */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: "Total ESPs",  value: devices.length, border: "border-t-ev-cyan" },
          { label: "Live now",    value: liveCount,       border: "border-t-green-500" },
          { label: "Unassigned",  value: unassignedCount, border: "border-t-slate-400" },
        ].map(({ label, value, border }) => (
          <div key={label} className={`rounded-xl border-t-2 border border-ev-border ${border} p-4 flex flex-col gap-1 bg-ev-panel shadow-sm w-40`}>
            <p className="text-xs text-slate-500 uppercase tracking-widest">{label}</p>
            <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
          </div>
        ))}

        {/* Sort + Search */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 shrink-0">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white border border-ev-border rounded-lg px-2 py-2 text-xs text-slate-600 focus:outline-none focus:border-ev-cyan"
          >
            <option value="serial">Serial</option>
            <option value="lastSeen">Last seen</option>
            <option value="team">Team name</option>
          </select>
          <input
            type="text"
            placeholder="Search serial…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-ev-cyan w-40"
          />
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading ESPs…</div>
      ) : displayDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-2 opacity-40 select-none">
          <p className="text-5xl">📡</p>
          <p className="text-slate-700 font-medium">
            {searchQuery ? "No ESPs match your search" : "No ESPs recorded yet"}
          </p>
          <p className="text-slate-400 text-sm">
            {searchQuery ? "Try a different serial number" : "Start the simulator or connect an ESP32 to see boards here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayDevices.map((device) => {
            const { ecu_serial, last_recorded_at, total_frames } = device
            const status        = getStatus(ecu_serial)
            const live          = liveData[ecu_serial]
            // Match by physical serial — team.ecu_serial is always the physical device serial
            const assignedTeam  = teams.find((t) => t.ecu_serial === ecu_serial) ?? null
            const compAssigns   = assignedTeam ? competitionMap.get(assignedTeam.id) ?? [] : []
            const busy          = assigning === ecu_serial
            const exporting     = exportingEsp === ecu_serial
            const lastSeen      = live?.last ? timeAgo(live.last.timestamp) : timeAgo(last_recorded_at)
            const isOfflineOrNoSession = status !== "live"

            return (
              <div key={ecu_serial} className={`bg-ev-panel border-2 rounded-xl p-5 flex flex-col gap-4 transition-colors ${status === "live" ? "border-green-400" : status === "offline" ? "border-red-400" : "border-ev-border shadow-sm"}`}>

                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                    <span className="font-bold text-slate-900 text-base">{formatEspLabel(ecu_serial)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[status].className}`}>
                      {STATUS_BADGE[status].label}
                    </span>
                    {/* Delete button — only when not live */}
                    {isOfflineOrNoSession && (
                      <button
                        onClick={() => setDeleteTarget(device)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-sm leading-none"
                        title="Delete this ESP and all its data"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Telemetry snapshot */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { label: "Voltage", value: live?.last?.avg_voltage, unit: "V" },
                      { label: "Current", value: live?.last?.avg_current, unit: "A" },
                      { label: "Power",   value: live?.last?.avg_power,   unit: "W" },
                    ] as { label: string; value: number | null | undefined; unit: string }[]
                  ).map(({ label, value, unit }) => (
                    <div key={label} className="bg-slate-50 border border-ev-border rounded-lg p-2.5 text-center">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">
                        {value != null ? `${value.toFixed(1)}${unit}` : "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Competition */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-ev-border">
                  <p className="text-xs text-slate-400">
                    {compAssigns.length > 1 ? "Competitions" : "Competition"}
                  </p>
                  {compAssigns.length === 0 ? (
                    <span className="text-sm text-slate-400">No competition</span>
                  ) : (
                    compAssigns.map((ca) => (
                      <div key={ca.competition_id} className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm font-medium text-slate-900 truncate">{ca.competition_name}</span>
                          <div className="flex flex-wrap gap-1">
                            {(ca.event_types.length > 0 ? ca.event_types : [ca.event_type]).map((et) => (
                              <span key={et} className={`text-xs px-1.5 py-0.5 rounded-full border capitalize font-medium ${EVENT_COLOURS[et] ?? ""}`}>
                                {et}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Link
                          to={`/competitions/${ca.competition_id}`}
                          className="text-xs text-ev-cyan hover:underline shrink-0"
                        >
                          View →
                        </Link>
                      </div>
                    ))
                  )}
                </div>

                {/* Assignment section */}
                <div className="flex flex-col gap-2 pt-1 border-t border-ev-border">
                  {assignedTeam ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">Assigned to</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{assignedTeam.team_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">
                            {assignedTeam.vehicle_class} · {assignedTeam.vehicle_type}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-400">Power limit</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {assignedTeam.power_limit != null ? `${assignedTeam.power_limit}W` : "—"}
                          </p>
                        </div>
                      </div>
                      <select
                        disabled={busy}
                        onChange={(e) => { if (e.target.value) handleAssign(ecu_serial, parseInt(e.target.value)); e.target.value = "" }}
                        defaultValue=""
                        className="w-full py-1.5 px-2 rounded-lg border border-ev-border text-xs text-slate-600 bg-white focus:outline-none focus:border-ev-cyan disabled:opacity-40"
                      >
                        <option value="" disabled>Reassign…</option>
                        {teams.filter((t) => t.id !== assignedTeam.id).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.team_name}{t.ecu_serial != null ? " (has ESP)" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setConfirmUnassign({ ecu_serial, teamName: assignedTeam.team_name })}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 self-start"
                      >
                        Unassign
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400">Not assigned to any team</p>
                      <select
                        disabled={busy || teams.length === 0}
                        onChange={(e) => { if (e.target.value) handleAssign(ecu_serial, parseInt(e.target.value)); e.target.value = "" }}
                        defaultValue=""
                        className="w-full py-1.5 px-2 rounded-lg border border-ev-border text-xs text-slate-600 bg-white focus:outline-none focus:border-ev-cyan disabled:opacity-40"
                      >
                        <option value="" disabled>
                          {busy ? "Assigning…" : teams.length === 0 ? "No teams available" : "Assign to team…"}
                        </option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.team_name}{t.ecu_serial != null ? " (has ESP)" : ""}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {/* Footer: last seen + frames + export */}
                <div className="flex items-center justify-between pt-1 border-t border-ev-border">
                  <div className="text-xs text-slate-400">
                    <span>Last seen: {lastSeen}</span>
                    <span className="mx-1.5">·</span>
                    <span>{total_frames.toLocaleString()} frames</span>
                  </div>
                  <div className="flex gap-1.5">
                    {(["csv", "pdf"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => handleExport(ecu_serial, fmt)}
                        disabled={exporting}
                        className="px-2 py-1 rounded border border-ev-border text-xs text-slate-500 hover:border-ev-cyan hover:text-ev-cyan transition-colors disabled:opacity-40"
                        title={`Export ${fmt.toUpperCase()}`}
                      >
                        {exporting ? "…" : `↓ ${fmt.toUpperCase()}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Unassign confirmation modal */}
      {confirmUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmUnassign(null)} />
          <div className="relative bg-ev-panel border border-ev-border rounded-2xl shadow-xl w-full max-w-sm flex flex-col gap-5 p-6">
            <div>
              <p className="text-xs text-red-500 uppercase tracking-widest font-semibold mb-1">Unassign ESP</p>
              <p className="text-slate-900 font-semibold text-base">
                Remove ESP-{confirmUnassign.ecu_serial} from {confirmUnassign.teamName}?
              </p>
              <p className="text-slate-400 text-sm mt-1">
                The ESP will become unassigned. No data will be deleted.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmUnassign(null)}
                className="px-4 py-2 text-sm text-slate-500 border border-ev-border rounded-lg hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleAssign(confirmUnassign.ecu_serial, null); setConfirmUnassign(null) }}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Unassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteEspModal
          device={deleteTarget}
          assignedTeam={teams.find((t) => t.ecu_serial === deleteTarget.ecu_serial) ?? null}
          competitions={competitionMap.get(
            teams.find((t) => t.ecu_serial === deleteTarget.ecu_serial)?.id ?? -1
          ) ?? []}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
