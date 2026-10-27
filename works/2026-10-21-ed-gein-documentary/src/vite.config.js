import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5432, strictPort: true },
  // Two pages: the interactive case file and the documentary film.
  build: { rollupOptions: { input: { main: 'index.html', film: 'film.html' } } },
})
