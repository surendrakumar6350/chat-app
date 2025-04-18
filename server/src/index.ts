import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import prisma from './db/prisma';
import { handleMessage } from './handlers/messageHandler';
import { handleClose } from './handlers/onCloseHandler';


const wss = new WebSocketServer({ port: 8080 });
console.log('WebSocket server started on ws://localhost:8080');
const clients = new Map<WebSocket, { id: string; username?: string }>();

const ipConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 5;

wss.on('connection', (ws: WebSocket, req) => {

  const ip = req.socket.remoteAddress || 'unknown';

  const currentCount = ipConnections.get(ip) || 0;
  if (currentCount >= MAX_CONNECTIONS_PER_IP) {
    console.log(`Too many connections from IP: ${ip}`);
    ws.close(1008, 'Too many connections from your IP');
    return;
  }

  ipConnections.set(ip, currentCount + 1);

  const clientId = uuidv4().slice(0, 8);
  clients.set(ws, { id: clientId });

  ws.send(
    JSON.stringify({
      type: 'yourId',
      message: clientId,
      onlineUsers: clients.size,
    })
  );

  console.log(`Client connected: ${clientId}`);

  ws.on('message', async (data: string | Buffer) => {
    await handleMessage(ws, data, clients, prisma);
  });

  ws.on('close', async () => {
    await handleClose(ws, clients);
    const updatedCount = (ipConnections.get(ip) || 1) - 1;
    if (updatedCount <= 0) {
      ipConnections.delete(ip);
    } else {
      ipConnections.set(ip, updatedCount);
    }
  });

});

