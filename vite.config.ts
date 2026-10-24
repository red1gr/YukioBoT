import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Point this at your bot's backend (FastAPI/aiohttp/etc).
const BACKEND = process.env.VITE_BACKEND ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': BACKEND, '/login': BACKEND, '/logout': BACKEND },
  },
})
