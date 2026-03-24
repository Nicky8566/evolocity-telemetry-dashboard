import { WebSocketServer } from 'ws';
// import { saveCounter } from './src/services/counterService.js';

let counter = 0;
let _wss = null;  // module-level reference so broadcast() can use it anywhere

export function broadcast(data) {
  if (!_wss) return;
  const message = JSON.stringify(data);
  _wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

export function initWebSocket(server) {
  const wss = new WebSocketServer({ server });
  _wss = wss;  // store reference for broadcast()

  // setInterval(() => {
  //   counter++;
  //   saveCounter(counter);
  //   broadcast({
  //     type: 'counter',
  //     message: `Hello, this message is from the backend. The number right now is at: ${counter}`,
  //     value: counter,
  //     timestamp: new Date().toISOString()
  //   });
  //   console.log(`Counter: ${counter}`);
  // }, 1000);

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