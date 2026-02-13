import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // This allows the specific cloud host that was blocked
    allowedHosts: [
      '5173-01khb1sbnr89rakbjk24r2ta6g.cloudspaces.litng.ai'
    ],
    proxy: {
      '/api': {
        // Using 127.0.0.1 is often more reliable in cloud environments than 'localhost'
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});