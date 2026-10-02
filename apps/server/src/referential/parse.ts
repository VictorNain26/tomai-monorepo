import { createHash } from 'node:crypto';
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

/** A block of the structure tree in reading order: heading, paragraph, list item or table. */
export interface Block {
  role: 'H1' | 'H2' | 'H3' | 'H4' | 'P' | 'LI' | 'TABLE';
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
/** A stacked fraction term: a number (digit groups allowed), a letter, or dots to fill. */
const FRACTION_TERM = /^(?:\d{1,3}(?: \d{3})+|\d+|\p{L}|\.{3}|…)$/u;
const SENTENCE_END = /[.!?:;»)]$/;
const LIST_MARKER = /^[—–−•-]\s*/u;
/** Rubric labels: they title a part of a section, not a theme. */
const RUBRIC = /^(?:connaissances et capacités attendues|attendus de fin)/i;
const CLOSING_RUBRIC = /^(?:prolongements possibles|mises en perspective)/i;
/** In cycle 3, automatisms are paragraphs about the student; other paragraphs are teacher notes. */
const ABOUT_STUDENT = /(?:^|\s)(?:l[’']élève|il|elle)\s/iu;
const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
/** Mathematical italic letters (𝑥) are plain letters; other characters keep their form (²). */
const MATH_ALPHANUMERIC = /[\u{1D400}-\u{1D7FF}]/gu;

function centre(item: PositionedText): number {
  return item.x + item.width / 2;
}

/** A number written in several runs on one line (« 1 », « », « 000 ») becomes one run. */
function coalesceNumbers(runs: readonly PositionedText[]): PositionedText[] {
  const out: PositionedText[] = [];
  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];
    if (!run) continue;
    const last = out.at(-1);
    const space = runs[i + 1];
    const digits = runs[i + 2];
    const sameLine = (a: PositionedText, b: PositionedText) => Math.abs(a.y - b.y) < 0.5 && b.x - (a.x + a.width) < 2;
    const groups = last !== undefined && /^\d[\d ]*$/.test(last.str) && run.str === ' ' && space !== undefined && /^\d{3}$/.test(space.str)
      && sameLine(last, run) && sameLine(run, space) && digits !== space;
    if (groups) {
      out[out.length - 1] = { ...last, str: `${last.str} ${space.str}`, width: space.x + space.width - last.x };
      i += 1;
      continue;
    }
    out.push(run);
  }
  return out;
}

/**
 * Joins the runs of one block. Word equations are not tagged as formulas: a fraction is two
 * smaller terms stacked around the line, numerator above, and becomes `a/b`; an exponent is
 * a smaller run raised above the line, and becomes superscript digits.
 */
export function joinRuns(raw: readonly PositionedText[]): { text: string; formula: boolean } {
  const runs = coalesceNumbers(raw);
  let text = '';
  let formula = false;
  let lineHeight = 0;
  let baseline = 0;
  const bodyHeight = Math.max(0, ...runs.map((run) => run.height));
  const small = (run: PositionedText) => run.height > 0 && run.height <= bodyHeight * 0.85;
  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];
    if (!run) continue;
    const next = runs[i + 1];
    const stacked = next !== undefined && FRACTION_TERM.test(run.str) && FRACTION_TERM.test(next.str) && small(run) && small(next)
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
    if (run.height > 0 && (lineHeight === 0 || run.height >= lineHeight * 0.85)) {
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
    .replace(/^-|-$/g, '');
}

function levelOf(heading: string): CollegeLevel | 'other' | null {
  const level = LEVELS[heading.toLowerCase()];
  if (level) return level;
  return /^cours moyen/i.test(heading) ? 'other' : null;
}

/**
 * Whether a block completes the previous entry: an item, lowercase or bulleted, under a
 * lead-in ending with « : » or after a sibling ending with « ; ». A capitalised sentence
 * after « : » is the next entry (the lead-in introduced a figure, which is not read).
 */
function completes(previous: string, block: string): boolean {
  return /[:;]$/.test(previous) && (/^\p{Ll}/u.test(block) || LIST_MARKER.test(block));
}

export interface ParseResult {
  entries: Entry[];
  /** Blocks inside an objectives or automatisms list that no class or domain could hold. */
  dropped: Block[];
  /** Teacher notes among the automatisms, left out and listed for review. */
  notes: Block[];
}

/**
 * Reads the objectives and automatisms of a programme from its blocks. H1 carries either
 * the domain or the class; classes outside collège (CM1, CM2) are left out. A paragraph
 * « Objectifs d'apprentissage » opens a list of objectives, a heading « Automatismes » a
 * list of automatisms; any other heading closes them. Items under a lead-in ending with
 * « : » join it. An id is the path of the entry plus a fingerprint of its wording, so it
 * survives reordering and extractor fixes.
 */
export function parseBlocks(blocks: readonly Block[], source: Pick<ProgrammeSource, 'id' | 'subject'>): ParseResult {
  const entries: Entry[] = [];
  const dropped: Block[] = [];
  const notes: Block[] = [];
  let domain = '';
  let level: CollegeLevel | 'other' | null = null;
  let subtheme: string | null = null;
  let subsubtheme: string | null = null;
  let mode: 'none' | 'objective' | 'automatism' = 'none';
  let open: Entry | null = null;
  let afterTable = false;

  for (const block of mergePageBreaks(blocks)) {
    if (block.role === 'TABLE') {
      // A table inside an entry is part of it, with the sentence that follows it; any other
      // table (quantitative guidance, outside the lists) is not an objective.
      if (open && mode !== 'none') {
        open.text = `${open.text} ${block.text}`;
        afterTable = true;
      }
      continue;
    }
    if (block.role !== 'P' && block.role !== 'LI') {
      open = null;
      afterTable = false;
      if (block.role === 'H1') {
        const found = levelOf(block.text);
        if (found) {
          level = found;
          subtheme = null;
          subsubtheme = null;
        } else if (!/^perspective annuelle/i.test(block.text)) {
          domain = block.text;
          level = null;
        }
        mode = 'none';
      } else if (block.role === 'H2') {
        subtheme = block.text;
        subsubtheme = null;
        mode = 'none';
      } else if (/^automatismes/i.test(block.text)) {
        mode = 'automatism';
      } else if (CLOSING_RUBRIC.test(block.text)) {
        mode = 'none';
      } else if (!RUBRIC.test(block.text)) {
        subsubtheme = block.text;
        mode = 'none';
      }
      continue;
    }
    if (/^objectifs d.apprentissage$/i.test(block.text)) {
      open = null;
      mode = 'objective';
      continue;
    }
    if (mode === 'none' || level === 'other') continue;
    if (level === null || !domain) {
      dropped.push(block);
      continue;
    }

    const wording = block.text.replace(LIST_MARKER, '');
    if (mode === 'automatism' && block.role === 'P' && !afterTable && !(open && completes(open.text, block.text)) && !ABOUT_STUDENT.test(block.text)) {
      notes.push(block);
      continue;
    }
    if (open && (afterTable || completes(open.text, block.text))) {
      afterTable = false;
      open.text = `${open.text} ${wording}`;
      open.formula ||= block.formula;
      continue;
    }
    const path = [source.id, level, slug(domain), ...(subtheme ? [slug(subtheme)] : []), ...(subsubtheme ? [slug(subsubtheme)] : [])].join('.');
    open = {
      id: path,
      level,
      subject: source.subject,
      domain,
      subtheme,
      subsubtheme,
      kind: mode,
      text: wording,
      page: block.page,
      formula: block.formula,
    };
    entries.push(open);
  }

  const seen = new Map<string, number>();
  for (const entry of entries) {
    const base = `${entry.id}.${entry.kind === 'objective' ? 'o' : 'a'}-${createHash('sha1').update(entry.text).digest('hex').slice(0, 8)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    entry.id = count === 1 ? base : `${base}-${String(count)}`;
  }
  return { entries, dropped, notes };
}
