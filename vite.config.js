import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    port: 5173,
    // Fail loudly if 5173 is occupied instead of silently moving to 5174.
    // Electron hard-loads http://localhost:5173 and the dev CSP only allows
    // ws://localhost:5173, so a drifted port silently breaks HMR (the renderer
    // loads a stale/zombie server and live updates never arrive). strictPort
    // surfaces a lingering process immediately so it can be killed.
    strictPort: true,
    fs: { strict: false },
    hmr: {
      host: 'localhost',
      port: 5173,
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