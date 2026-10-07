import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tomia.fr',
  trailingSlash: 'never',
  // aide.html rather than aide/index.html: the Caddyfile serves /aide without a redirect to /aide/.
  build: { format: 'file' },
  server: { port: 3001 },
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  // No Markdown here; Shiki's inline styles would only trip the CSP check.
  markdown: { syntaxHighlight: false },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Nunito',
      cssVariable: '--font-nunito',
      weights: ['200 1000'],
      styles: ['normal'],
      subsets: ['latin'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Caveat',
      cssVariable: '--font-caveat',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
    },
  ],
  security: {
    csp: {
      directives: ["default-src 'self'"],
      // Motion renders each reveal's starting state as a style attribute, and the Radix sheet of the mobile
      // menu adds a <style> to lock the page's scroll: neither can carry a hash. Scripts stay hash-locked.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
});
