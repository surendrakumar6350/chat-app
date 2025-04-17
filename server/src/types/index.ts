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

export type { ExtendedWebSocket, Message };