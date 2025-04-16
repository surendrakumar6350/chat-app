import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Extend WebSocket to include custom fields
interface ExtendedWebSocket extends WebSocket {
  id: string;
  username?: string;
}

interface Message {
  type: string;
  message: string;
  id?: string;
  username?: string;
  clientId?: string;
}

const wss = new WebSocketServer({ port: 8080 });
const clients: ExtendedWebSocket[] = [];

wss.on('connection', (ws: WebSocket) => {
  const extendedWs = ws as ExtendedWebSocket;
  const clientId = uuidv4().slice(0, 8);
  extendedWs.id = clientId;

  extendedWs.send(
    JSON.stringify({
      type: 'yourId',
      message: clientId,
      onlineUsers: clients.length,
    })
  );

  clients.push(extendedWs);
  console.log(`Client connected: ${clientId}`);

  extendedWs.on('message', (data: string | Buffer) => {
    const messageString = typeof data === 'string' ? data : data.toString();
    console.log(`Message from ${extendedWs.id}: ${messageString}`);

    let parsed: Message;
    try {
      parsed = JSON.parse(messageString);
    } catch (err) {
      console.error('Invalid message received:', messageString);
      return;
    }

    if (parsed.type === 'addUsername') {
      const client = clients.find((c) => c.id === parsed.clientId);
      if (client) {
        client.username = parsed.message;
      }

      const activeClients = clients
        .filter((c) => c.username)
        .map((c) => ({ id: c.id, username: c.username }));

      clients.forEach((client) => {
        client.send(
          JSON.stringify({
            type: 'activeClients',
            message: activeClients,
            id: client.id,
            username: client.username,
          })
        );
      });

      return;
    }

    if (parsed.type === 'newMessage') {
      clients.forEach((client) => {
        if (client.id !== parsed.id) {
          client.send(
            JSON.stringify({
              type: 'newMessage',
              message: parsed.message,
              username: parsed.username,
              id: parsed.id,
            })
          );
        }
      });

      return;
    }

    // Broadcast other messages
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  });

  extendedWs.on('close', () => {
    console.log(`Client disconnected: ${extendedWs.id}`);
    const index = clients.findIndex((client) => client.id === extendedWs.id);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});
