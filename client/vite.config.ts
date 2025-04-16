import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
    server: {
    allowedHosts: [
      'chat.speedexchange.in',
      'localhost',
      '7d06-103-68-43-208.ngrok-free.app'
    ]
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
