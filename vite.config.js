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
        'scmap-popout': path.resolve(__dirname, 'src/components/tabs/Tools/ScmapTab/Pop-Out/scmap-popout.html'),
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
    fs: { strict: false }
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