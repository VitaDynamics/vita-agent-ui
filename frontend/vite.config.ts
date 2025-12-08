import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Load env files from the workspace root so Vite can see .env/.env.local placed there.
  envDir: '..',
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    strictPort: true,
    allowedHosts: ['agent.vitarobot.cc']
  },
})
