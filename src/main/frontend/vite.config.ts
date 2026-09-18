import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api to Spring Boot so the browser only ever talks to one origin (no CORS in dev).
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
