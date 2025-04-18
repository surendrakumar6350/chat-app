import { WebSocket } from 'ws';
import type { PrismaClient } from '@prisma/client';
import type { Message } from '../types';
import { handleAddUsername } from './message/addUsernameHandler';
import { handleNewMessage } from './message/newMessageHandler';

export async function handleMessage(
  ws: WebSocket,
  data: string | Buffer,
  clients: Map<WebSocket, { id: string; username?: string }>,
  prisma: PrismaClient
): Promise<void> {

  const messageString = typeof data === 'string' ? data : data.toString();
  const clientInfo = clients.get(ws);

  console.log(`Message from ${clientInfo?.id}: ${messageString}`);

  let parsed: Message;
  try {
    parsed = JSON.parse(messageString);
  } catch (err) {
    console.error('Invalid message received:', messageString);
    return;
  }

  switch (parsed.type) {
    case 'addUsername':
      await handleAddUsername(ws, parsed, clients, prisma);
      break;

    case 'newMessage':
      await handleNewMessage(ws, parsed, clients, prisma);
      break;

    default:
      // Broadcast other messages
      clients.forEach((_info, clientSocket) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(messageString);
        }
      });
      break;
  }
}