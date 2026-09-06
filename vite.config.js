import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'node:module';

// One source of truth for the dev port — Electron and the dev CSP read the
// same constant. See electron/dev-server.js.
const { DEV_PORT } = createRequire(import.meta.url)('./electron/dev-server.js');

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: false,
    rollupOptions: {
      input: {
        main:        path.resolve(__dirname, 'index.html'),
        'scmap-popout': path.resolve(__dirname, 'src/components/tabs/MapTools/Scmap/PopOut/scmapPopout.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) {
            return 'react-dom-vendor';
          }
          if (id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-markdown') ||
              id.includes('node_modules/remark-gfm') ||
              id.includes('node_modules/remark') ||
              id.includes('node_modules/unified') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/mdast')) {
            return 'markdown-vendor';
          }
        }
      }
    }
  },
  server: {
    port: DEV_PORT,
    // Fail loudly if the port is occupied instead of silently moving to the
    // next one. Electron hard-loads this exact origin and the dev CSP allows
    // only this origin and its HMR websocket, so a drifted port silently breaks
    // HMR (the renderer loads a stale/zombie server and live updates never
    // arrive). strictPort surfaces a lingering process immediately.
    strictPort: true,
    fs: { strict: false },
    hmr: {
      host: 'localhost',
      port: DEV_PORT,
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'react-markdown',
      'remark-gfm',
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './public/assets')
    }
  }
});