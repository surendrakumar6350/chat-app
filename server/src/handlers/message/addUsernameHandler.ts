import { WebSocket } from 'ws';
import type { PrismaClient } from '@prisma/client';
import { addUsernameSchema } from '../../types/zod';
import { handleClose } from '../onCloseHandler';
import { ZodError } from 'zod';

export async function handleAddUsername(
    ws: WebSocket,
    parsed: any,
    clients: Map<WebSocket, { id: string; username?: string }>,
    prisma: PrismaClient
): Promise<void> {
    try {
        addUsernameSchema.parse(parsed);

        const clientInfo = clients.get(ws);
        if (clientInfo) {
            clientInfo.username = parsed.message;
            clients.set(ws, clientInfo);
        }

        const recentMessages = await prisma.message.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        ws.send(
            JSON.stringify({
                type: 'recentMessages',
                message: recentMessages.reverse(),
            })
        );

        const activeClients = Array.from(clients.values())
            .filter((c) => c.username)
            .map((c) => ({ id: c.id, username: c.username! }));

        clients.forEach((info, clientSocket) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(
                    JSON.stringify({
                        type: 'activeClients',
                        message: activeClients,
                        id: info.id,
                        username: info.username,
                    })
                );
            }
        });
    } catch (error) {
        console.error('Error in handleAddUsername:', error);

        if (error instanceof ZodError) {
            const message = error.issues.map(issue => issue.message).join(', ');

            ws.send(
                JSON.stringify({
                    type: 'newMessage',
                    message: message,
                    username: 'Admin',
                    id: 'admin',
                })
            );
        } else {
            ws.send(
                JSON.stringify({
                    type: 'newMessage',
                    message: 'Something went wrong while processing your username.',
                    username: 'Admin',
                    id: 'admin',
                })
            );
        }

        await handleClose(ws, clients);
    }
}