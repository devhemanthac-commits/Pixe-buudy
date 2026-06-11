import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // Serve assets/ at the web root: sprites/cat.png works in dev (http) and
  // packaged (file://, copied into dist/) alike
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
  },
})
