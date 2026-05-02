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
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [boardData, setBoardData] = useState<BoardData>({})
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const zeroTimeoutsRef           = useRef<Record<string, number>>({})

  // Pre-populate charts with stored history on first load
  useEffect(() => {
    ecuApi
      .history()
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

  // Data WebSocket — telemetry frames at 10Hz
  useEffect(() => {
    const ws = new WebSocket(WS_URL)

    ws.onopen  = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type !== "ecu_frame") return

        const frame: ECUFrame = msg.data
        const boardId = `ECU-${frame.ecu_serial}`

        window.clearTimeout(zeroTimeoutsRef.current[boardId])

        setBoardData((prev) => {
          const updated = [...(prev[boardId] ?? []), frame].slice(-200)
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
            return { ...prev, [boardId]: [...existing, zeroFrame].slice(-200) }
          })
        }, 3000)
      } catch {
        // ignore malformed messages
      }
    }

    const timeouts = zeroTimeoutsRef.current
    return () => {
      ws.close()
      Object.values(timeouts).forEach(window.clearTimeout)
    }
  }, [])

  // Alerts WebSocket — separate connection, low volume
  useEffect(() => {
    const ws = new WebSocket(ALERTS_WS_URL)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type !== "alert") return
        const alert: Alert = msg.data
        setAlerts((prev) => [alert, ...prev])
      } catch {
        // ignore malformed messages
      }
    }

    return () => ws.close()
  }, [])

  return (
    <TelemetryContext.Provider value={{ connected, boardData, alerts }}>
      {children}
    </TelemetryContext.Provider>
  )
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error("useTelemetry must be used inside <TelemetryProvider>")
  return ctx
}
