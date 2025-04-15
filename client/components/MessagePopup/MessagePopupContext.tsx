import React, { createContext, useContext, useState } from 'react';

type MessageType = 'info' | 'success' | 'error' | 'warning';

export interface Message {
  id: string;
  type: MessageType;
  title?: string;
  content: string;
  duration?: number;
}

interface MessageContextType {
  messages: Message[];
  showMessage: (message: Omit<Message, 'id'>) => void;
  removeMessage: (id: string) => void;
}

const MessageContext = createContext<MessageContextType>({
  messages: [],
  showMessage: () => {},
  removeMessage: () => {},
});

export const useMessagePopup = () => useContext(MessageContext);

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const showMessage = (message: Omit<Message, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newMessage = { ...message, id };
    setMessages((prev) => [...prev, newMessage]);

    if (message.duration !== 0) {
      setTimeout(() => {
        removeMessage(id);
      }, message.duration || 5000);
    }
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
  };

  return (
    <MessageContext.Provider value={{ messages, showMessage, removeMessage }}>
      {children}
    </MessageContext.Provider>
  );
};
