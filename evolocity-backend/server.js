import 'dotenv/config';
import { createServer } from 'http';
import app from './app.js';
import { initWebSocket } from './websocket.js';

const PORT = process.env.PORT || 3001;

const server = createServer(app);

initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`WebSocket ready at ws://localhost:${PORT}`);
});