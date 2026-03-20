import { WebSocketServer } from 'ws';
import { insertValue } from './db.js'; 

let counter = 0;

function broadcast(wss, data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

export function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  setInterval(() => {
    counter++;
    // insert value to db every tick
    insertValue(counter);  
    broadcast(wss, {
      type: 'counter',
      message: `Hello, this message is from the backend. The number right now is at: ${counter}`,
      value: counter,
      timestamp: new Date().toISOString()
    });
    console.log(`Counter: ${counter}`);
  }, 1000);

  wss.on('connection', (ws) => {
    console.log('Frontend connected via WebSocket');
    ws.send(JSON.stringify({
      type: 'hello',
      message: 'Connected to EVolocity backend!',
      timestamp: new Date().toISOString()
    }));
    ws.on('close', () => console.log('Frontend disconnected'));
    ws.on('error', (err) => console.error('WS error:', err.message));
  });
}