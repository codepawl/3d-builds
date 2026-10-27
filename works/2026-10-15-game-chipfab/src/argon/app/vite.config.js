import { defineConfig } from 'vite';
import reactPlugin from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [reactPlugin()],
  server: {
    port: 5425,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5425,
    strictPort: true,
    host: true,
  },
});
