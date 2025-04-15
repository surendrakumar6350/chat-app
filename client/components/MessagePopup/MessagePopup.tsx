import { useMessagePopup } from './MessagePopupContext';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export const MessagePopup = () => {
  const { messages, removeMessage } = useMessagePopup();

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-3 max-w-sm w-full">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`relative flex items-start gap-3 rounded-lg shadow-lg p-4 border transition-all duration-300 animate-in fade-in slide-in-from-top-5 ${getMessageStyles(
            message.type
          )}`}
        >
          <div className="flex-shrink-0 pt-0.5">
            {message.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {message.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            {message.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
            {message.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
          </div>
          <div className="flex-1 pt-0.5">
            {message.title && <h3 className="font-medium text-sm">{message.title}</h3>}
            <p className="text-sm text-gray-300 mt-1">{message.content}</p>
          </div>
          <button
            onClick={() => removeMessage(message.id)}
            className="absolute top-1 right-1 p-1 rounded-full hover:bg-gray-700/50"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      ))}
    </div>
  );
};

function getMessageStyles(type: 'info' | 'success' | 'error' | 'warning'): string {
  switch (type) {
    case 'success':
      return 'bg-gray-800 border-green-600 text-white';
    case 'error':
      return 'bg-gray-800 border-red-600 text-white';
    case 'warning':
      return 'bg-gray-800 border-yellow-600 text-white';
    case 'info':
    default:
      return 'bg-gray-800 border-blue-600 text-white';
  }
}
