import { useEffect, useState, useRef } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

interface Message {
  type: string
  message: string
  value?: number
  timestamp: string
}

function App() {
  const [status, setStatus] = useState('Connecting...')
  const [liveMessage, setLiveMessage] = useState<Message | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setStatus('Connected to backend')

      ws.onmessage = (event) => {
        const msg: Message = JSON.parse(event.data)
        if (msg.type === 'counter' || msg.type === 'hello') {
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
    return () => wsRef.current?.close()
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
      <h1>EVolocity Dashboard</h1>
      <p><strong>Status:</strong> {status}</p>
      <div style={{ background: '#f0f4ff', padding: 16, borderRadius: 8 }}>
        <h2>Live (WebSocket)</h2>
        {liveMessage ? (
          <>
            <p style={{ fontSize: 18 }}>{liveMessage.message}</p>
            <p style={{ color: '#888', fontSize: 12 }}>{liveMessage.timestamp}</p>
          </>
        ) : (
          <p>Waiting for data...</p>
        )}
      </div>
    </div>
  )
}

export default App