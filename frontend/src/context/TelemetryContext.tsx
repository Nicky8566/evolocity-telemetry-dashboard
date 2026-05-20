import {
  createContext,
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

  // Pre-populate charts with the last 5 minutes of stored data on first load
  useEffect(() => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    ecuApi
      .history({ from: fiveMinAgo })
      .then(({ data: rows }) => {
        if (rows.length === 0) return
        const grouped: BoardData = {}
        rows.forEach((row) => {
          const boardId = `ECU-${row.ecu_serial}`
          if (!grouped[boardId]) grouped[boardId] = []
          grouped[boardId].push(row)
        })
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

      // onerror is always followed by onclose — just let onclose handle the retry
      ws.onerror = () => ws.close()

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type !== "ecu_frame") return

          const frame: ECUFrame = msg.data
          const boardId = `ECU-${frame.ecu_serial}`

          window.clearTimeout(zeroTimeoutsRef.current[boardId])

          setBoardData((prev) => {
            const cutoff = Date.now() - 5 * 60 * 1000
            const existing = prev[boardId] ?? []
            // Remove any synthetic zero frames from the tail (injected during silence/disconnect)
            // so reconnection doesn't produce dips to 0 in the chart.
            let end = existing.length
            while (end > 0 && existing[end - 1].avg_voltage === 0) end--
            const updated = [...existing.slice(0, end), frame].filter(
              (f) => new Date(f.timestamp).getTime() >= cutoff
            )
            return { ...prev, [boardId]: updated }
          })

          // 3s silence → inject a zero frame so the chart drops to 0
          zeroTimeoutsRef.current[boardId] = window.setTimeout(() => {
            setBoardData((prev) => {
              const existing = prev[boardId] ?? []
              if (existing.length === 0) return prev
              const last = existing[existing.length - 1]
              if (last.avg_voltage === 0) return prev
              const zeroFrame: ECUFrame = {
                ...last,
                timestamp:   new Date().toISOString(),
                avg_voltage: 0,
                avg_current: 0,
                avg_power:   null,
                avg_energy:  null,
              }
              const cutoff = Date.now() - 5 * 60 * 1000
              return { ...prev, [boardId]: [...existing, zeroFrame].filter((f) => new Date(f.timestamp).getTime() >= cutoff) }
            })
          }, 3000)
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    const timeouts = zeroTimeoutsRef.current
    return () => {
      destroyed = true
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
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
