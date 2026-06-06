import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// GitHub Pages serves project sites from /<repo>/, so the production build needs
// that base path. Local dev (`vite`) stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/foodiee/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
}))
