import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/', // ✅ ensures assets load correctly on Render

  // ✅ proxy only during local development
  server: {
    proxy:
      command === 'serve'
        ? {
            '/api': {
              target: 'http://localhost:8000',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          }
        : undefined,
  },
}));
