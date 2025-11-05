import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Obtenir les variables d'environnement
  const env = process.env;
  const proxyTarget = env['VITE_PROXY_TARGET'] || 'http://localhost:3000';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@/components': path.resolve(__dirname, 'src/components'),
        '@/utils': path.resolve(__dirname, 'src/utils'),
        '@/hooks': path.resolve(__dirname, 'src/hooks'),
        '@/types': path.resolve(__dirname, 'src/types'),
        '@/store': path.resolve(__dirname, 'src/store'),
        '@/pages': path.resolve(__dirname, 'src/pages'),
        '@/constants': path.resolve(__dirname, 'src/constants'),
        '@/assets': path.resolve(__dirname, 'src/assets'),
        '@shared-types': path.resolve(__dirname, '../shared-types'),
      },
    },

    server: {
      port: 5173,
      host: true,
      proxy: {
        // Configuration spéciale pour Server-Sent Events
        '/api/chat/stream': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: false, // Désactiver WebSocket upgrade pour SSE
          timeout: 0, // Pas de timeout pour les connexions SSE longues
          proxyTimeout: 0, // Pas de timeout proxy pour SSE
          headers: {
            'Origin': 'http://localhost:5173',
            'Cache-Control': 'no-cache',
            'Accept': 'text/event-stream'
          },
          // Configuration spécifique pour le streaming
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Assurer que les headers SSE sont bien transmis
              proxyReq.setHeader('Cache-Control', 'no-cache');
              proxyReq.setHeader('Accept', 'text/event-stream');
            });

            proxy.on('proxyRes', (proxyRes) => {
              // Assurer que les headers SSE sont bien retournés
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
              proxyRes.headers['content-type'] = 'text/event-stream; charset=utf-8';
            });
          }
        },
        // Configuration standard pour les endpoints API
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          timeout: 60000, // Timeout unifié 1 minute
          proxyTimeout: 60000,
          headers: {
            'Origin': 'http://localhost:5173'
          }
        }
      }
    },
  
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    minify: mode === 'production' ? 'esbuild' : false,
    target: 'es2022',
    cssTarget: 'chrome80',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendors chunk
          vendor: ['react', 'react-dom', 'react-router'],
          // UI chunk
          ui: ['lucide-react', 'framer-motion', 'sonner'],
          // Auth chunk
          auth: ['better-auth'],
          // Editor chunk (plus volumineux)
          editor: ['react-markdown', 'katex', 'rehype-katex', 'remark-math'],
        },
        // Optimiser les noms de fichiers pour le cache
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace(/\.(js|ts|tsx)$/, '') || 'chunk'
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    assetsInlineLimit: 4096, // 4KB
    cssCodeSplit: true,
    reportCompressedSize: false, // Plus rapide en CI
  },
  
  
    define: {
      // Expose environment mode to runtime
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});