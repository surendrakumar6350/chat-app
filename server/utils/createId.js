function generateUniqueClientId(wss) {
  let id;
  const existingIds = new Set();

  for (const client of wss.clients) {
    if (client.id) existingIds.add(client.id);
  }

  do {
    id = Math.floor(1000 + Math.random() * 9000);
  } while (existingIds.has(id));

  return id;
}
export default generateUniqueClientId;