import { useEffect, useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { WEB_SOCKET_ADDRESS } from '../constants';

interface Message {
  text: string;
  sender: "you" | "other";
}

function App() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WEB_SOCKET_ADDRESS);

    ws.onopen = () => {
      console.log("✅ Connected to WebSocket");
      setConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      setMessages((prev) => [...prev, { text: event.data, sender: "other" }]);
    };

    ws.onclose = () => {
      console.log("❌ Disconnected");
      setConnected(false);
    };

    setSocket(ws);

    return () => ws.close();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = (): void => {
    if (socket && input.trim()) {
      socket.send(input);
      setMessages((prev) => [...prev, { text: input, sender: "you" }]);
      setInput("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setInput(e.target.value);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      <header className="bg-gray-800 text-white px-6 py-4 shadow-lg border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold">WebSocket Chat</div>
            {connected ? (
              <span className="flex items-center text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full mr-1"></span>
                Connected
              </span>
            ) : (
              <span className="flex items-center text-xs bg-red-600 text-white px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full mr-1"></span>
                Disconnected
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-grow p-6 overflow-hidden">
        <div className="bg-gray-800 rounded-lg shadow-lg h-full flex flex-col border border-gray-700">
          <div className="flex-grow p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-6">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender === "you" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${msg.sender === "you"
                        ? "bg-purple-600 text-white rounded-br-none"
                        : "bg-gray-700 text-gray-200 rounded-bl-none"
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                className="flex-grow px-4 py-2 bg-gray-700 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={!connected}
              />
              <button
                className="bg-purple-600 text-white px-6 py-2 rounded-full font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={sendMessage}
                disabled={!connected || !input.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;