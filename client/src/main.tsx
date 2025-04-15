import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MessageProvider, MessagePopup } from '../components/MessagePopup'


createRoot(document.getElementById('root')!).render(
    <MessageProvider>
        <App />
        <MessagePopup />
    </MessageProvider>
)
