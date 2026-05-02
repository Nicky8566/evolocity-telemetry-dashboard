import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { WS_URL } from "../api"
import { ecuApi } from "../api/ecu"
import type { BoardData, ECUFrame, LatestFrames } from "../types"

interface TelemetryContextValue {
  connected: boolean
  boardData: BoardData
  latestFrames: LatestFrames
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected]       = useState(false)
  const [boardData, setBoardData]       = useState<BoardData>({})
  const [latestFrames, setLatestFrames] = useState<LatestFrames>({})
  const zeroTimeoutsRef                 = useRef<Record<string, number>>({})

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
          grouped[boardId].push({
            timeMs: grouped[boardId].length * 100,
            voltage: row.avg_voltage,
          })
        })
        setBoardData(grouped)
      })
      .catch((err) => console.error("Failed to load ECU history:", err))
  }, [])

  // WebSocket — opens once here, survives all page navigation
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

        // Keep latest frame per board so Dashboard can do voltage monitoring
        setLatestFrames((prev) => ({ ...prev, [boardId]: frame }))

        // Clear any pending zero-point timeout for this board
        window.clearTimeout(zeroTimeoutsRef.current[boardId])

        // Append new point to rolling 200-point buffer
        setBoardData((prev) => {
          const existing   = prev[boardId] ?? []
          const lastTimeMs = existing.length > 0 ? existing[existing.length - 1].timeMs : 0
          const updated    = [
            ...existing,
            { timeMs: lastTimeMs + 100, voltage: frame.avg_voltage },
          ].slice(-200)
          return { ...prev, [boardId]: updated }
        })

        // If this board goes silent for 3s, drop voltage to 0 on the chart
        zeroTimeoutsRef.current[boardId] = window.setTimeout(() => {
          setBoardData((prev) => {
            const existing = prev[boardId] ?? []
            if (existing.length === 0) return prev
            const last = existing[existing.length - 1]
            if (last.voltage === 0) return prev
            const updated = [
              ...existing,
              { timeMs: last.timeMs + 100, voltage: 0 },
            ].slice(-200)
            return { ...prev, [boardId]: updated }
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

  return (
    <TelemetryContext.Provider value={{ connected, boardData, latestFrames }}>
      {children}
    </TelemetryContext.Provider>
  )
}

// Custom hook — throws a helpful error if used outside the provider
export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error("useTelemetry must be used inside <TelemetryProvider>")
  return ctx
}
