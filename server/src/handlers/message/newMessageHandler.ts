import { WebSocket } from 'ws';
import type { PrismaClient } from '@prisma/client';
import * as leoProfanity from 'leo-profanity';
import { newMessageSchema } from '../../types/zod';

export async function handleNewMessage(
    ws: WebSocket,
    parsed: any,
    clients: Map<WebSocket, { id: string; username?: string }>,
    prisma: PrismaClient
): Promise<void> {
    try {
        newMessageSchema.parse(parsed);

        const clientInfo = clients.get(ws);
        if (!clientInfo || !clientInfo.username) {
            ws.send(
                JSON.stringify({
                    type: 'newMessage',
                    message: 'User not found. Please set a username before sending messages.',
                    username: 'Admin',
                    id: 'admin',
                })
            );
            ws.send(
                JSON.stringify({
                    type: 'newMessage',
                    message: 'Refresh the page to set a username.',
                    username: 'Admin',
                    id: 'admin',
                })
            );
            return;
        }

        if (leoProfanity.check(parsed.message)) {
            ws.send(
                JSON.stringify({
                    type: 'newMessage',
                    message: 'Your message contains inappropriate content and cannot be sent.',
                    username: 'Admin',
                    id: 'admin',
                })
            );
            return;
        }

        await prisma.message.create({
            data: {
                message: parsed.message,
                username: parsed.username,
                senderId: parsed.id || '',
            },
        });

        clients.forEach((info, clientSocket) => {
            if (info.id !== parsed.id && clientSocket.readyState === WebSocket.OPEN) {
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
    } catch (error) {
        console.error('Error in handleNewMessage:', error);
        ws.send(
            JSON.stringify({
                type: 'newMessage',
                message: 'Something went wrong while processing your message.',
                username: 'Admin',
                id: 'admin',
            })
        );
    }
}