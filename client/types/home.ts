interface ChatMessage {
    id: string;
    type: 'system' | 'self' | 'other';
    text: string;
    timestamp: Date;
    username?: string;
}

interface UserData {
    id: string;
    username: string;
}

export type { ChatMessage, UserData };