import { useEffect, useState, useRef } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

interface ECUFrame {
  ecu_serial: number
  timestamp: string
  voltage_samples: number[]
  avg_voltage: number
  avg_current: number | null
  penalty: boolean
}

interface HistoryRow {
  id: number
  ecu_serial: number
  timestamp: string
  avg_voltage: number
  penalty: number
  recorded_at: string
}

function App() {
  const [status, setStatus] = useState('Connecting...')
  const [latestFrame, setLatestFrame] = useState<ECUFrame | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const connectedRef = useRef(false)

  // REST API — fetch all past ECU frames on page load
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/ecu/history`)
      .then(res => res.json())
      .then(json => setHistory(json.data || []))
      .catch(() => console.error('Could not fetch ECU history'))
  }, [])

  // WebSocket — receive live ECU frames as they arrive
  useEffect(() => {
    if (connectedRef.current) return
    connectedRef.current = true

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setStatus('Connected to backend ✅')

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)

        if (msg.type === 'ecu_frame') {
          const frame: ECUFrame = msg.data
          setLatestFrame(frame)
          setHistory(prev => [...prev, {
            id: prev.length + 1,
            ecu_serial: frame.ecu_serial,
            timestamp: frame.timestamp,
            avg_voltage: frame.avg_voltage,
            penalty: frame.penalty ? 1 : 0,
            recorded_at: new Date().toISOString()
          }])
        }

        if (msg.type === 'hello') {
          setStatus('Connected to backend ✅')
        }
      }

      ws.onclose = () => {
        setStatus('Disconnected — retrying in 3s...')
        setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '40px auto', padding: '0 20px', color: '#111' }}>
      <h1>EVolocity Dashboard</h1>
      <p style={{ color: '#111' }}><strong>Status:</strong> {status}</p>

      <div style={{ background: '#f0f4ff', padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ color: '#111' }}>Latest ECU Frame (Live)</h2>
        {latestFrame ? (
          <div style={{ color: '#111' }}>
            <p><strong>ECU Serial:</strong> {latestFrame.ecu_serial}</p>
            <p><strong>Timestamp:</strong> {latestFrame.timestamp}</p>
            <p><strong>Avg Voltage (scaled):</strong> {latestFrame.avg_voltage.toFixed(2)} V</p>
            <p><strong>Raw Samples (mV):</strong> [{latestFrame.voltage_samples.join(', ')}]</p>
            <p><strong>Penalty:</strong>{' '}
              <span style={{ color: latestFrame.penalty ? '#e53e3e' : '#38a169', fontWeight: 'bold' }}>
                {latestFrame.penalty ? '⚠️ YES — exceeded 2kW' : '✅ None'}
              </span>
            </p>
          </div>
        ) : (
          <p style={{ color: '#111' }}>Waiting for data from ESP32...</p>
        )}
      </div>

      <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 8 }}>
        <h2 style={{ color: '#111', margin: '0 0 8px 0' }}>Frame History (REST + live)</h2>
        <p style={{ color: '#555', fontSize: 13 }}>
          Past frames loaded from SQLite on page load. New frames appended live.
        </p>
        <div style={{ maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, color: '#111' }}>
          {history.length === 0 ? (
            <p style={{ color: '#111' }}>No frames yet.</p>
          ) : (
            history.map((row, i) => (
              <div key={i} style={{ color: row.penalty ? '#e53e3e' : '#111', marginBottom: 2 }}>
                [{row.recorded_at}] ECU {row.ecu_serial} | {row.avg_voltage?.toFixed(2)}V
                {row.penalty ? ' ⚠️ PENALTY' : ''}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App