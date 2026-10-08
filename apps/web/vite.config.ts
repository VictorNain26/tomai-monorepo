import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Manifest colors can't read CSS variables: --color-background in packages/tokens/theme.css.
const PAPER = '#F6F6F3';

const DEV_PORT = 3002;
const API = 'http://localhost:3000';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    VitePWA({
      // A new version takes over without a prompt. With injectRegister left to 'auto', the
      // registration is a registerSW.js file, never an inline script the server's CSP would block.
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tom',
        short_name: 'Tom',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: PAPER,
        theme_color: PAPER,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // No runtime caching: an /api response, a pupil's data, never lands in a cache. A
        // navigation to /api, such as the OAuth callback, reaches the server.
        navigateFallbackDenylist: [/^\/api(\/|$)/],
      },
    }),
  ],
  // No data: URI in the build: the server's CSP allows this origin only.
  build: { assetsInlineLimit: 0 },
  // Same origin as in production: the browser sees one origin, the session cookie stays first-party.
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: {
      '/api/': API,
      '/health': API,
    },
  },
});
