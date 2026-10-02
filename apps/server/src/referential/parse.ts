import type { CollegeLevel, Entry } from './schema.js';
import type { ProgrammeSource } from './sources.js';

/** A text run of a PDF page, with its position (PDF units, y grows upwards). */
export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  eol: boolean;
}

/** A block of the structure tree in reading order: heading, paragraph or list item. */
export interface Block {
  role: 'H1' | 'H2' | 'H3' | 'H4' | 'P' | 'LI';
  text: string;
  page: number;
  formula: boolean;
}

const LEVELS: Record<string, CollegeLevel> = {
  sixième: 'sixieme',
  cinquième: 'cinquieme',
  quatrième: 'quatrieme',
  troisième: 'troisieme',
};
/** A stacked fraction term: a number, or the dots of a blank to fill. */
const FRACTION_TERM = /^(?:\d+|\.{3}|…)$/;
const SENTENCE_END = /[.!?:;»)]$/;

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
};
/** Mathematical italic letters (𝑥) are plain letters; other characters keep their form (²). */
const MATH_ALPHANUMERIC = /[\u{1D400}-\u{1D7FF}]/gu;

function centre(item: PositionedText): number {
  return item.x + item.width / 2;
}

/**
 * Joins the runs of one block. Word equations are not tagged as formulas: a fraction is two
 * numbers stacked around the line, numerator above, and becomes `a/b`; an exponent is a
 * smaller run raised above the line, and becomes superscript digits.
 */
export function joinRuns(runs: readonly PositionedText[]): { text: string; formula: boolean } {
  let text = '';
  let formula = false;
  let lineHeight = 0;
  let baseline = 0;
  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];
    if (!run) continue;
    const next = runs[i + 1];
    const stacked = next !== undefined && FRACTION_TERM.test(run.str) && FRACTION_TERM.test(next.str)
      && Math.abs(centre(run) - centre(next)) < 3 && run.y - next.y > 3 && run.y - next.y < 15;
    if (stacked) {
      text += `${run.str}/${next.str}`;
      formula = true;
      i += 1;
      continue;
    }
    const exponent = /^\d+$/.test(run.str) && run.height > 0 && run.height < lineHeight * 0.75 && run.y > baseline + 1;
    if (exponent) {
      text = text.trimEnd() + Array.from(run.str).map((digit) => SUPERSCRIPT_DIGITS[digit] ?? digit).join('');
      formula = true;
      continue;
    }
    if (run.height > 0) {
      lineHeight = run.height;
      baseline = run.y;
    }
    text += run.eol ? `${run.str} ` : run.str;
  }
  return { text: text.replace(MATH_ALPHANUMERIC, (char) => char.normalize('NFKC')).replace(/\s+/g, ' ').trim(), formula };
}

/** Glues a paragraph cut by a page break back to the one it continues. */
export function mergePageBreaks(blocks: readonly Block[]): Block[] {
  const merged: Block[] = [];
  for (const block of blocks) {
    const previous = merged.at(-1);
    const continues = previous !== undefined && block.page === previous.page + 1 && block.role === previous.role
      && (block.role === 'P' || block.role === 'LI') && !SENTENCE_END.test(previous.text) && /^\p{Ll}/u.test(block.text);
    if (continues) {
      merged[merged.length - 1] = { ...previous, text: `${previous.text} ${block.text}`, formula: previous.formula || block.formula };
    } else {
      merged.push(block);
    }
  }
  return merged;
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
}

function levelOf(heading: string): CollegeLevel | 'other' | null {
  const level = LEVELS[heading.toLowerCase()];
  if (level) return level;
  return /^cours moyen/i.test(heading) ? 'other' : null;
}

/**
 * Reads the objectives and automatisms of a programme from its blocks. H1 carries either
 * the domain or the class; classes outside collège (CM1, CM2) are dropped. A paragraph
 * « Objectifs d'apprentissage » opens a list of objectives, a heading « Automatismes » a
 * list of automatisms; any other heading closes them.
 */
export function parseBlocks(blocks: readonly Block[], source: Pick<ProgrammeSource, 'id' | 'subject'>): Entry[] {
  const entries: Entry[] = [];
  const counters = new Map<string, number>();
  let domain = '';
  let level: CollegeLevel | 'other' | null = null;
  let subtheme = '';
  let subsubtheme: string | null = null;
  let mode: 'none' | 'objective' | 'automatism' = 'none';

  for (const block of mergePageBreaks(blocks)) {
    if (block.role === 'H1') {
      const found = levelOf(block.text);
      if (found) {
        level = found;
        subtheme = '';
        subsubtheme = null;
      } else if (!/^perspective annuelle/i.test(block.text)) {
        domain = block.text;
        level = null;
      }
      mode = 'none';
      continue;
    }
    if (block.role === 'H2') {
      subtheme = block.text;
      subsubtheme = null;
      mode = 'none';
      continue;
    }
    if (block.role === 'H3' || block.role === 'H4') {
      if (/^automatismes/i.test(block.text)) mode = 'automatism';
      else if (/^prolongements possibles/i.test(block.text)) mode = 'none';
      else {
        subsubtheme = block.text;
        mode = 'none';
      }
      continue;
    }
    if (/^objectifs d.apprentissage$/i.test(block.text)) {
      mode = 'objective';
      continue;
    }
    const kind: Entry['kind'] | null = mode === 'objective' ? 'objective' : mode === 'automatism' && block.role === 'LI' ? 'automatism' : null;
    if (kind === null || level === null || level === 'other' || !domain || !subtheme) continue;

    const path = [source.id, level, slug(domain), slug(subtheme), ...(subsubtheme ? [slug(subsubtheme)] : [])].join('.');
    const counterKey = `${path}:${kind}`;
    const index = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, index);
    entries.push({
      id: `${path}.${kind === 'objective' ? 'o' : 'a'}${String(index).padStart(2, '0')}`,
      level,
      subject: source.subject,
      domain,
      subtheme,
      subsubtheme,
      kind,
      text: block.role === 'LI' ? block.text.replace(/^[—–−•-]\s*/u, '') : block.text,
      page: block.page,
      formula: block.formula,
    });
  }
  return entries;
}
