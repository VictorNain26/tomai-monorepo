import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { APIRoute } from 'astro';
import satori from 'satori';
import sharp from 'sharp';
import { BRAND_NAME } from '@/lib/brand';
import { OG_IMAGE } from '@/lib/open-graph';

// Drawn at build time, the image follows the brand name: satori lays it out as next/og did.

// satori reads no CSS variable: copied from packages/tokens/theme.css.
const PAPER = '#FAF7F0';
const INK = '#1D1D22';
const PRIMARY = '#1F3F9E';
const HIGHLIGHT = '#F9E08B';
const MUTED = '#5C5C66';

// satori takes React's element shape, without React.
const node = (type: string, style: Record<string, unknown>, children: unknown) => ({ type, key: null, props: { style, children } });

export const GET: APIRoute = async () => {
  // WOFF: satori reads neither WOFF2 nor the fonts Astro downloads.
  const nunito = await readFile(fileURLToPath(import.meta.resolve('@fontsource/nunito/files/nunito-latin-800-normal.woff')));
  const tom = `data:image/png;base64,${(await readFile('src/assets/tom.png')).toString('base64')}`;

  const svg = await satori(
    node(
      'div',
      { width: '100%', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 80, background: PAPER, color: INK, fontFamily: 'Nunito' },
      [
        node('div', { display: 'flex', flexDirection: 'column', width: 640 }, [
          node('div', { display: 'flex', fontSize: 44, color: PRIMARY }, BRAND_NAME),
          node('div', { display: 'flex', flexWrap: 'wrap', marginTop: 40, fontSize: 64, lineHeight: 1.1 }, [
            node('span', {}, "Le soir, l'exercice "),
            node('span', {}, 'restera '),
            node('span', { backgroundImage: `linear-gradient(to top, ${HIGHLIGHT} 50%, transparent 50%)` }, 'le sien'),
            '.',
          ]),
          node('div', { display: 'flex', marginTop: 40, fontSize: 30, color: MUTED }, 'En préparation, pour le collège (6e à 3e)'),
        ]),
        { type: 'img', key: null, props: { src: tom, width: 560, height: 560 } },
      ],
    ),
    { ...OG_IMAGE, fonts: [{ name: 'Nunito', data: nunito, style: 'normal', weight: 800 }] },
  );
  return new Response(new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer()), { headers: { 'Content-Type': 'image/png' } });
};
