import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend runs on :8000. Proxying /api keeps the browser on one origin (no CORS setup needed).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
