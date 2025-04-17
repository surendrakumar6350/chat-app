import { WebSocket } from 'ws';

export async function handleClose(
    ws: WebSocket,
    clients: Map<WebSocket, { id: string; username?: string }>
): Promise<void> {
    const clientInfo = clients.get(ws);

    if (clientInfo) {
        console.log(`Client disconnected: ${clientInfo.id}`);
        clients.delete(ws);

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
    }
}