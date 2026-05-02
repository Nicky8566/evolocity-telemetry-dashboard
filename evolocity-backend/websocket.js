import { WebSocketServer } from 'ws';

let _wssData   = null;
let _wssAlerts = null;

export function broadcast(data) {
  if (!_wssData) return;
  const message = JSON.stringify(data);
  _wssData.clients.forEach(client => {
    if (client.readyState === 1) client.send(message);
  });
}

export function broadcastAlert(data) {
  if (!_wssAlerts) return;
  const message = JSON.stringify(data);
  _wssAlerts.clients.forEach(client => {
    if (client.readyState === 1) client.send(message);
  });
}

export function initWebSocket(server) {
  const wssData = new WebSocketServer({ server, path: '/data' });
  _wssData = wssData;

  const wssAlerts = new WebSocketServer({ server, path: '/alerts' });
  _wssAlerts = wssAlerts;

  wssData.on('connection', (ws) => {
    console.log('Frontend connected to /data');
    ws.send(JSON.stringify({
      type: 'hello',
      message: 'Connected to EVolocity backend!',
      timestamp: new Date().toISOString()
    }));
    ws.on('close', () => console.log('Frontend disconnected from /data'));
    ws.on('error', (err) => console.error('WS /data error:', err.message));
  });

  wssAlerts.on('connection', (ws) => {
    console.log('Frontend connected to /alerts');
    ws.on('close', () => console.log('Frontend disconnected from /alerts'));
    ws.on('error', (err) => console.error('WS /alerts error:', err.message));
  });
}
