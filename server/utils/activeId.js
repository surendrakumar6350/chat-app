function getClientIdMap(wss, ws) {
  const clientMap = {};

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.id && client !== ws) {
      clientMap[client.id] = true;
    }
  }

  return clientMap;
}
export default getClientIdMap;