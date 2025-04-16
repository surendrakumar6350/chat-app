import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
const wss = new WebSocketServer({ port: 8080 });

const clients = [];

wss.on('connection', (ws) => {
  const clientId = uuidv4().slice(0, 8);
  ws.id = clientId;
  ws.send(JSON.stringify({ type: "yourId", message: clientId, onlineUsers: clients.length }));

  clients.push(ws);

  console.log(`Client connected: ${clientId}`);

  ws.on('message', (message) => {
    console.log(`Message from ${ws.id}: ${message}`);
    let parsed = JSON.parse(message);

    if (parsed.type == "addUsername") {
      clients.forEach((client) => {
        if (client.id == parsed.clientId) {
          ws.username = JSON.parse(message).message;
        }
      })
      clients.forEach((client) => {
        client.send(JSON.stringify({
          type: "activeClients", message: clients.map((client) => {
            if (client.username) return { id: client.id, username: client.username }
          }), id: client.id, username: client.username
        }));
      });
      return;
    }


    if (parsed.type == "newMessage") {
      clients.forEach((client) => {
        if (client.id != parsed.id) {
          client.send(JSON.stringify({
            type: "newMessage", message: parsed.message,
            username: parsed.username, id: parsed.id
          }));
        }
      });
      return;
    }

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: false });
      }
    });
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${ws.id}`);
    const index = clients.findIndex((client) => client.id === ws.id);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});
