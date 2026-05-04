import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    host: true,
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 100 * 1024 * 1024,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
