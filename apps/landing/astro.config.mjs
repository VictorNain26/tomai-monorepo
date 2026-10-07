import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tomia.fr',
  trailingSlash: 'never',
  // aide.html rather than aide/index.html: the Caddyfile serves /aide without a redirect to /aide/.
  build: { format: 'file' },
  server: { port: 3001 },
  integrations: [sitemap()],
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
    },
  },
});
