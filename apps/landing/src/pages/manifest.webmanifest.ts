import { BRAND_NAME } from '@/lib/brand';

// A manifest can't read CSS variables: copied from packages/tokens/theme.css.
const PAPER = '#FAF7F0';

export function GET() {
  return Response.json({
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: 'Une aide aux devoirs pour les collégiens, de la 6e à la 3e, en préparation.',
    start_url: '/',
    display: 'standalone',
    background_color: PAPER,
    theme_color: PAPER,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}
