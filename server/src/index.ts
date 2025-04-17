import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import prisma from './db/prisma';
import { handleMessage } from './handlers/messageHandler';
import { handleClose } from './handlers/onCloseHandler';


const wss = new WebSocketServer({ port: 8080 });
const clients = new Map<WebSocket, { id: string; username?: string }>();

wss.on('connection', (ws: WebSocket) => {
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
  });

});

