import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Served from the root of the custom domain (foodiee.live), so base is '/'.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
})
