import { useEffect, useMemo, useState } from "react"
import { ecuApi } from "../api/ecu"
import { teamsApi } from "../api/teams"
import { useTelemetry } from "../context/TelemetryContext"
import type { Team } from "../types"

interface EcuDevice {
  ecu_serial:       number
  last_recorded_at: string
  total_frames:     number
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 5000)    return "just now"
  if (diff < 60000)   return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString()
}

type Status = "live" | "offline" | "no-session"

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

export default function EcuMonitor() {
  const { boardData }                   = useTelemetry()
  const [devices, setDevices]           = useState<EcuDevice[]>([])
  const [teams, setTeams]               = useState<Team[]>([])
  const [loading, setLoading]           = useState(true)
  const [assigning, setAssigning]       = useState<number | null>(null)

  function load() {
    setLoading(true)
    Promise.all([ecuApi.status(), teamsApi.list()])
      .then(([{ devices: devs }, { data: teamList }]) => {
        setDevices(devs)
        setTeams(teamList)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleAssign(ecuSerial: number, newTeamId: number | null) {
    setAssigning(ecuSerial)
    try {
      // Clear ECU from whichever team currently holds it (may differ from newTeamId)
      const currentHolder = teams.find((t) => t.ecu_serial === ecuSerial)
      if (currentHolder) await teamsApi.updateEcu(currentHolder.id, null)
      // Assign to new team if one was selected
      if (newTeamId !== null) await teamsApi.updateEcu(newTeamId, String(ecuSerial))
      const { data: updated } = await teamsApi.list()
      setTeams(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setAssigning(null)
    }
  }

  // Live telemetry snapshot per serial from WebSocket context
  const liveData = useMemo(() => {
    const map: Record<number, { last: (typeof boardData)[string][number]; isLive: boolean }> = {}
    for (const [boardId, frames] of Object.entries(boardData)) {
      const serial = parseInt(boardId.replace("ECU-", ""))
      const last   = frames.at(-1)
      if (last) {
        const isLive = last.avg_voltage > 0 && Date.now() - new Date(last.timestamp).getTime() < 5000
        map[serial]  = { last, isLive }
      }
    }
    return map
  }, [boardData])

  const liveCount       = Object.values(liveData).filter((d) => d.isLive).length
  const unassignedCount = devices.filter((d) => !teams.some((t) => t.ecu_serial === d.ecu_serial)).length

  function getStatus(serial: number): Status {
    const d = liveData[serial]
    if (!d) return "no-session"
    return d.isLive ? "live" : "offline"
  }

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
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg border border-ev-border text-xs text-slate-500 hover:border-ev-cyan hover:text-ev-cyan transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Summary stat chips */}
      <div className="flex gap-3">
        {[
          { label: "Total ESPs",  value: devices.length, accent: "text-slate-400" },
          { label: "Live now",    value: liveCount,       accent: "text-green-500" },
          { label: "Unassigned",  value: unassignedCount, accent: "text-slate-400" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-ev-panel border border-ev-border rounded-xl px-5 py-3 flex flex-col gap-0.5">
            <span className={`text-xs uppercase tracking-widest font-semibold ${accent}`}>{label}</span>
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          Loading ESPs...
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-2 opacity-40 select-none">
          <p className="text-5xl">📡</p>
          <p className="text-slate-700 font-medium">No ESPs recorded yet</p>
          <p className="text-slate-400 text-sm">Start the simulator or connect an ESP32 to see boards here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            const { ecu_serial, last_recorded_at, total_frames } = device
            const status       = getStatus(ecu_serial)
            const live         = liveData[ecu_serial]
            const assignedTeam = teams.find((t) => t.ecu_serial === ecu_serial) ?? null
            const busy         = assigning === ecu_serial
            const lastSeen     = live?.last ? timeAgo(live.last.timestamp) : timeAgo(last_recorded_at)

            return (
              <div
                key={ecu_serial}
                className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-4 shadow-sm"
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                    <span className="font-bold text-slate-900 text-base">ESP-{ecu_serial}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[status].className}`}>
                    {STATUS_BADGE[status].label}
                  </span>
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

                {/* Assignment section */}
                <div className="flex flex-col gap-2 pt-1 border-t border-ev-border">
                  {assignedTeam ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-slate-400">Assigned to</p>
                          <p className="text-sm font-semibold text-slate-900">{assignedTeam.team_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {assignedTeam.vehicle_class} · {assignedTeam.vehicle_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Power limit</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {assignedTeam.power_limit != null ? `${assignedTeam.power_limit}W` : "—"}
                          </p>
                        </div>
                      </div>
                      {/* Reassign to different team */}
                      <select
                        disabled={busy}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) handleAssign(ecu_serial, parseInt(val))
                          e.target.value = ""
                        }}
                        defaultValue=""
                        className="w-full py-1.5 px-2 rounded-lg border border-ev-border text-xs text-slate-600 bg-white focus:outline-none focus:border-ev-cyan disabled:opacity-40"
                      >
                        <option value="" disabled>Reassign to different team…</option>
                        {teams
                          .filter((t) => t.id !== assignedTeam.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.team_name}{t.ecu_serial != null ? " (has ESP)" : ""}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleAssign(ecu_serial, null)}
                        disabled={busy}
                        className="w-full py-1.5 rounded-lg border border-ev-border text-xs text-slate-500 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        {busy ? "Unassigning…" : "Unassign"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400">Not assigned to any team</p>
                      <select
                        disabled={busy || teams.length === 0}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) handleAssign(ecu_serial, parseInt(val))
                          e.target.value = ""
                        }}
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

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-ev-border">
                  <span>Last seen: {lastSeen}</span>
                  <span>{total_frames.toLocaleString()} frames</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
