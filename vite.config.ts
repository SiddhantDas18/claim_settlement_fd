import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend runs on :8000 by default (override with BACKEND_URL). Proxying /api keeps the browser on one origin (no CORS setup needed).
const backend = process.env.BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
      '/health': backend,
    },
  },
})
