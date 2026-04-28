import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist/client'
  }
});
