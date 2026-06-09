import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    strictPort: true,
    proxy: {
      '/api': {
        // 127.0.0.1 (not localhost) so we hit our API over IPv4, not an
        // unrelated IPv6 service that may also be on this port.
        target: 'http://127.0.0.1:4100',
        changeOrigin: true,
      },
    },
  },
});
