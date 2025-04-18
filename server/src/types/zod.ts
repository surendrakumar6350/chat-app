import { z } from 'zod';

export const newMessageSchema = z.object({
    type: z.literal('newMessage'),
    message: z.string()
        .min(1, { message: 'Message cannot be empty' })
        .max(100, { message: 'Message is too long. Max 100 characters allowed.' }),
    id: z.string().min(1),
    username: z.string().min(1).max(50),
});


export const addUsernameSchema = z.object({
    type: z.literal('addUsername'),
    message: z.string().min(1, { message: 'username is too short' })
        .max(10, { message: 'username is too large.' }),
    clientId: z.string().min(1).max(20),
});