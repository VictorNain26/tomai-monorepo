import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { BRAND_NAME } from '@/lib/brand';

export const alt = `${BRAND_NAME} – Une aide aux devoirs pour le collège, en préparation`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// ImageResponse ne lit pas les variables CSS : copie de packages/tokens/theme.css.
const PAPER = '#FAF7F0';
const INK = '#1D1D22';
const PRIMARY = '#1F3F9E';
const HIGHLIGHT = '#F9E08B';
const MUTED = '#5C5C66';

const nunito = await readFile(join(process.cwd(), 'assets/nunito-latin-800-normal.ttf'));
const tom = `data:image/png;base64,${await readFile(join(process.cwd(), 'assets/tom.png'), 'base64')}`;

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 80,
        background: PAPER,
        color: INK,
        fontFamily: 'Nunito',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: 640 }}>
        <div style={{ display: 'flex', fontSize: 44, color: PRIMARY }}>{BRAND_NAME}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 40, fontSize: 64, lineHeight: 1.1 }}>
          <span>Le soir, l&apos;exercice&nbsp;</span>
          <span>restera&nbsp;</span>
          <span style={{ backgroundImage: `linear-gradient(to top, ${HIGHLIGHT} 50%, transparent 50%)` }}>le sien</span>.
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 30, color: MUTED }}>En préparation, pour le collège (6e à 3e)</div>
      </div>
      <img src={tom} width={560} height={560} alt="" />
    </div>,
    { ...size, fonts: [{ name: 'Nunito', data: nunito, style: 'normal', weight: 800 }] },
  );
}
