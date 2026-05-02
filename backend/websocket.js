import { WebSocketServer } from 'ws';
import { URL } from 'url';

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
  // noServer: true — manual upgrade routing is required when multiple
  // WebSocketServers share one http.Server; letting both attach directly
  // causes them to race on the upgrade event and corrupt the handshake.
  const wssData   = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const wssAlerts = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  _wssData   = wssData;
  _wssAlerts = wssAlerts;

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/data') {
      wssData.handleUpgrade(request, socket, head, (ws) => {
        wssData.emit('connection', ws, request);
      });
    } else if (pathname === '/alerts') {
      wssAlerts.handleUpgrade(request, socket, head, (ws) => {
        wssAlerts.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

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
