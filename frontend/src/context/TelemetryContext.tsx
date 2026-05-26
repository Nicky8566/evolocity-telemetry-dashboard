import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ALERTS_WS_URL, WS_URL } from "../api"
import { ecuApi } from "../api/ecu"
import type { Alert, BoardData, ECUFrame } from "../types"

interface TelemetryContextValue {
  connected: boolean
  boardData: BoardData
  alerts:    Alert[]
  /** Bumped whenever a run or penalty event is broadcast. */
  runsVersion:       number
  /** Bumped whenever a penalty is broadcast. */
  penaltiesVersion:  number
  /** Map of competition_id → version. Bumped when that competition's leaderboard should refetch. */
  leaderboardNudges: Record<number, number>
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

const STORE_WINDOW_MS = 5 * 60 * 1000  // 5 minutes of device time kept in memory

// Insert `frame` into `arr` at the correct chronological position (sorted by
// timestamp_ms).  Handles buffered-dump frames that arrive out of order.
// When a real (non-synthetic) frame arrives, all synthetic placeholder zeros
// are stripped so reconnection dumps cleanly replace the disconnection dip.
function sortedInsert(arr: ECUFrame[], frame: ECUFrame): ECUFrame[] {
  const base = frame.synthetic ? arr : arr.filter(f => !f.synthetic)
  const idx  = base.findIndex(f => f.timestamp_ms > frame.timestamp_ms)
  if (idx === -1) return [...base, frame]
  if (base[idx - 1]?.timestamp_ms === frame.timestamp_ms) return base  // dedupe
  return [...base.slice(0, idx), frame, ...base.slice(idx)]
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected]                 = useState(false)
  const [boardData, setBoardData]                 = useState<BoardData>({})
  const [alerts, setAlerts]                       = useState<Alert[]>([])
  const [runsVersion, setRunsVersion]             = useState(0)
  const [penaltiesVersion, setPenaltiesVersion]   = useState(0)
  const [leaderboardNudges, setLeaderboardNudges] = useState<Record<number, number>>({})
  const zeroTimeoutsRef                           = useRef<Record<string, number>>({})
  const wsRef                                     = useRef<WebSocket | null>(null)
  const reconnectTimerRef                         = useRef<number | null>(null)
  const reconnectDelayRef                         = useRef(1000)
  const pendingFramesRef                          = useRef<ECUFrame[]>([])
  const flushIntervalRef                          = useRef<number | null>(null)

  // Pre-populate charts with the last 5 minutes of stored data on first load.
  useEffect(() => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    ecuApi
      .history({ from: fiveMinAgo })
      .then(({ data: rows }) => {
        if (rows.length === 0) return
        const grouped: BoardData = {}
        rows.forEach((row) => {
          const timestamp_ms = new Date(row.timestamp).getTime()
          const frame: ECUFrame = { ...row, timestamp_ms }
          const boardId = `ECU-${frame.ecu_serial}`
          if (!grouped[boardId]) grouped[boardId] = []
          grouped[boardId].push(frame)
        })
        Object.values(grouped).forEach(arr => arr.sort((a, b) => a.timestamp_ms - b.timestamp_ms))
        setBoardData(grouped)
      })
      .catch((err) => console.error("Failed to load ECU history:", err))
  }, [])

  // Data WebSocket — telemetry frames at 10Hz, with exponential-backoff reconnection
  useEffect(() => {
    let destroyed = false

    function connect() {
      if (destroyed) return
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        reconnectDelayRef.current = 1000
      }

      ws.onclose = () => {
        setConnected(false)
        if (destroyed) return
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 10000)
          connect()
        }, reconnectDelayRef.current)
      }

      ws.onerror = () => ws.close()

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type !== "ecu_frame") return

          const frame: ECUFrame = msg.data
          const boardId = `ECU-${frame.ecu_serial}`

          // Buffer the frame — the flush interval will commit it to state.
          window.clearTimeout(zeroTimeoutsRef.current[boardId])
          pendingFramesRef.current.push(frame)

          // 8s of silence → inject a synthetic zero frame to drop the chart.
          // The zero frame slots just after the last real frame and is stripped if real data resumes.
          zeroTimeoutsRef.current[boardId] = window.setTimeout(() => {
            setBoardData((prev) => {
              const existing = prev[boardId] ?? []
              if (existing.length === 0) return prev
              const last = existing[existing.length - 1]
              if (last.synthetic) return prev
              const zeroMs    = last.timestamp_ms + 100
              const zeroFrame: ECUFrame = {
                ...last,
                timestamp:       new Date().toISOString(),
                timestamp_ms:    zeroMs,
                received_at_ms:  last.received_at_ms,
                synthetic:       true,
                avg_voltage:     0,
                avg_current:     0,
                avg_power:       0,
                avg_energy:      0,
              }
              const latestMs = zeroMs
              const cutoff   = latestMs - STORE_WINDOW_MS
              return {
                ...prev,
                [boardId]: [...existing, zeroFrame].filter(f => f.timestamp_ms >= cutoff),
              }
            })
          }, 8000)
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    // Flush buffered frames to state at 200ms intervals (~5 renders/s instead of 10).
    // All frames that arrived since the last flush are applied in a single setBoardData call.
    flushIntervalRef.current = window.setInterval(() => {
      if (pendingFramesRef.current.length === 0) return
      const pending = pendingFramesRef.current.splice(0)
      startTransition(() => setBoardData((prev) => {
        const next = { ...prev }
        for (const frame of pending) {
          const boardId  = `ECU-${frame.ecu_serial}`
          const inserted = sortedInsert(next[boardId] ?? [], frame)
          const latestMs = inserted[inserted.length - 1].timestamp_ms
          const cutoff   = latestMs - STORE_WINDOW_MS
          next[boardId]  = inserted.filter(f => f.timestamp_ms >= cutoff)
        }
        return next
      }))
    }, 200)

    const timeouts = zeroTimeoutsRef.current
    return () => {
      destroyed = true
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
      if (flushIntervalRef.current   !== null) window.clearInterval(flushIntervalRef.current)
      wsRef.current?.close()
      Object.values(timeouts).forEach(window.clearTimeout)
    }
  }, [])

  // Alerts WebSocket — separate connection, low volume
  useEffect(() => {
    const ws = new WebSocket(ALERTS_WS_URL)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        switch (msg.type) {
          case "alert": {
            const alert: Alert = msg.data
            setAlerts((prev) => {
              const idx = prev.findIndex((a) => a.id === alert.id)
              if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = alert
                return updated
              }
              return [alert, ...prev]
            })
            break
          }
          case "run":
            setRunsVersion((v) => v + 1)
            break
          case "penalty":
          case "penalty-deleted":
            setPenaltiesVersion((v) => v + 1)
            break
          case "leaderboard": {
            const cid = msg.data?.competition_id
            if (typeof cid === "number") {
              setLeaderboardNudges((prev) => ({ ...prev, [cid]: (prev[cid] ?? 0) + 1 }))
            }
            break
          }
          default:
            break
        }
      } catch {
        // ignore malformed messages
      }
    }

    return () => ws.close()
  }, [])

  return (
    <TelemetryContext.Provider value={{ connected, boardData, alerts, runsVersion, penaltiesVersion, leaderboardNudges }}>
      {children}
    </TelemetryContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error("useTelemetry must be used inside <TelemetryProvider>")
  return ctx
}
