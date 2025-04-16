import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
    server: {
    allowedHosts: [
      'chat.speedexchange.in',
      'localhost',
      'da8d-45-248-193-239.ngrok-free.app'
    ]
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
