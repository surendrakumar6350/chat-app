import { WebSocket } from 'ws';
import type { PrismaClient } from '@prisma/client';
import type { Message } from '../types';

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
      if (clientInfo) {
        clientInfo.username = parsed.message;
        clients.set(ws, clientInfo);
      }

      const activeClients = Array.from(clients.values())
        .filter((c) => c.username)
        .map((c) => ({ id: c.id, username: c.username! }));

      clients.forEach((info, clientSocket) => {
        clientSocket.send(
          JSON.stringify({
            type: 'activeClients',
            message: activeClients,
            id: info.id,
            username: info.username,
          })
        );
      });
      break;

    case 'newMessage':
      await prisma.message.create({
        data: {
          message: parsed.message,
          username: parsed.username,
          senderId: parsed.id || '',
        },
      });

      clients.forEach((info, clientSocket) => {
        if (info.id !== parsed.id) {
          clientSocket.send(
            JSON.stringify({
              type: 'newMessage',
              message: parsed.message,
              username: parsed.username,
              id: parsed.id,
            })
          );
        }
      });
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