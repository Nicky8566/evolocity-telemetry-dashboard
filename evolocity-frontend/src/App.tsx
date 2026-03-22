import { useEffect, useState, useRef } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

interface Message {
  type: string
  message: string
  value?: number
  timestamp: string
}

interface HistoryRow {
  id: number
  value: number
  recorded_at: string
}

function App() {
  const [status, setStatus] = useState('Connecting...')
  const [liveMessage, setLiveMessage] = useState<Message | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const connectedRef = useRef(false) // prevents double connection in React Strict Mode

  // REST API — fetch past data once on page load
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/counter/history`)
      .then(res => res.json())
      .then(json => setHistory(json.data || []))
      .catch(() => console.error('Could not fetch history'))
  }, [])

  // WebSocket — live updates
  useEffect(() => {
    if (connectedRef.current) return // stop double connect in Strict Mode
    connectedRef.current = true

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setStatus('Connected to backend')

      ws.onmessage = (event) => {
        const msg: Message = JSON.parse(event.data)
        if (msg.type === 'counter') {
          setLiveMessage(msg)
          setHistory(prev => {
            // prevent duplicate if value already exists
            if (prev.some(r => r.value === msg.value)) return prev
            return [...prev, {
              id: msg.value!,
              value: msg.value!,
              recorded_at: msg.timestamp
            }]
          })
        }
        if (msg.type === 'hello') {
          setLiveMessage(msg)
        }
      }

      ws.onclose = () => {
        setStatus('Disconnected — retrying in 3s...')
        setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [])

  // Reset — clears DB via REST, clears frontend state
  function handleReset() {
    fetch(`${BACKEND_URL}/api/counter/reset`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        setHistory([])
        setLiveMessage(null)
      })
      .catch(() => console.error('Reset failed'))
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 700, margin: '40px auto', padding: '0 20px', color: '#111' }}>
      <h1>EVolocity Dashboard</h1>
      <p style={{ color: '#f0f4ff' }}><strong>Status:</strong> {status}</p>

      <div style={{ background: '#f0f4ff', padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ color: '#111' }}>Live (WebSocket)</h2>
        {liveMessage ? (
          <>
            <p style={{ fontSize: 18, color: '#111' }}>{liveMessage.message}</p>
            <p style={{ color: '#555', fontSize: 12 }}>{liveMessage.timestamp}</p>
          </>
        ) : (
          <p style={{ color: '#111' }}>Waiting for data...</p>
        )}
      </div>

      <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ color: '#111', margin: 0 }}>History (REST API + live)</h2>
          <button
            onClick={handleReset}
            style={{
              background: '#e53e3e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reset
          </button>
        </div>
        <p style={{ color: '#555', fontSize: 13 }}>
          Past values loaded from SQLite via REST on page load. New values appended live via WebSocket.
        </p>
        <div style={{ maxHeight: 250, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, color: '#111' }}>
          {history.length === 0 ? <p style={{ color: '#111' }}>No history yet.</p> : (
            history.map((row, i) => (
              <div key={i} style={{ color: '#111' }}>[{row.recorded_at}] value = {row.value}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App