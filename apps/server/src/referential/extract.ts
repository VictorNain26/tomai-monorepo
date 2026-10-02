/**
 * `bun run referential:extract`: downloads each official PDF, checks its pinned SHA-256,
 * reads its structure tree with pdf.js and writes `texts/<source id>.json`. Every entry is
 * read again in the plain text of its page, letters only, and the run fails if a wording
 * is not found there.
 */
import { mkdir } from 'node:fs/promises';
import { getDocumentProxy } from 'unpdf';
import { joinRuns, parseBlocks, type Block, type PositionedText } from './parse.js';
import { PROGRAMME_SOURCES, type ProgrammeSource } from './sources.js';
import type { Entry, TextFile } from './schema.js';

type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;
type Page = Awaited<ReturnType<Pdf['getPage']>>;
type StructNode = Awaited<ReturnType<Page['getStructTree']>>;
type TextContentItem = Awaited<ReturnType<Page['getTextContent']>>['items'][number];

const BLOCK_ROLES = new Set(['H1', 'H2', 'H3', 'H4', 'P']);
const SKIPPED_ROLES = new Set(['TOC', 'Figure', 'Lbl']);

function isNode(child: StructNode['children'][number]): child is StructNode {
  return 'role' in child;
}

/** Text runs of each marked-content id; nested marked content belongs to its parent id. */
function runsById(items: readonly TextContentItem[]): Map<string, PositionedText[]> {
  const byId = new Map<string, PositionedText[]>();
  const stack: (string | null)[] = [];
  for (const item of items) {
    if ('type' in item) {
      if (item.type === 'beginMarkedContentProps' || item.type === 'beginMarkedContent') stack.push(item.id || (stack.at(-1) ?? null));
      else if (item.type === 'endMarkedContent') stack.pop();
      continue;
    }
    const id = stack.at(-1);
    if (!id) continue;
    const runs = byId.get(id) ?? [];
    runs.push({ str: item.str, x: Number(item.transform[4]), y: Number(item.transform[5]), width: item.width, height: item.height, eol: item.hasEOL });
    byId.set(id, runs);
  }
  return byId;
}

function contentIds(node: StructNode): string[] {
  return node.children.flatMap((child) => {
    if (isNode(child)) return SKIPPED_ROLES.has(child.role) ? [] : contentIds(child);
    return child.type === 'content' ? [child.id] : [];
  });
}

function pageBlocks(tree: StructNode, runs: Map<string, PositionedText[]>, page: number): Block[] {
  const blocks: Block[] = [];
  const emit = (role: Block['role'], node: StructNode) => {
    const { text, formula } = joinRuns(contentIds(node).flatMap((id) => runs.get(id) ?? []));
    if (text) blocks.push({ role, text, page, formula });
  };
  const walk = (node: StructNode) => {
    if (SKIPPED_ROLES.has(node.role)) return;
    if (BLOCK_ROLES.has(node.role)) emit(node.role as Block['role'], node);
    else if (node.role === 'LI') emit('LI', node);
    else if (node.role === 'TD' || node.role === 'TH') emit('P', node);
    else node.children.filter(isNode).forEach(walk);
  };
  walk(tree);
  return blocks;
}

/** Letters only: spacing and splits between text runs differ between the two readings. */
function letters(text: string): string {
  return (text.normalize('NFKC').toLowerCase().match(/\p{L}+/gu) ?? []).join('');
}

async function extract(source: ProgrammeSource): Promise<{ file: TextFile; formulas: Entry[] }> {
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`${source.id}: HTTP ${String(response.status)}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  if (sha256 !== source.sha256) throw new Error(`${source.id}: SHA-256 ${sha256} differs from the pinned one, a new text to review`);

  const pdf = await getDocumentProxy(bytes);
  const blocks: Block[] = [];
  const plain: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent({ includeMarkedContent: true });
    plain.push(letters(content.items.map((item) => ('str' in item ? item.str : '')).join('')));
    blocks.push(...pageBlocks(await page.getStructTree(), runsById(content.items), number));
  }

  const entries = parseBlocks(blocks, source);
  const missing = entries.filter((entry) => !`${plain[entry.page - 1] ?? ''}${plain[entry.page] ?? ''}`.includes(letters(entry.text)));
  if (missing.length > 0) throw new Error(`${source.id}: not found in the page text: ${missing.map((e) => e.id).join(', ')}`);
  return { file: { sourceId: source.id, sha256, entries }, formulas: entries.filter((e) => e.formula) };
}

/** One entry per line: a new BO shows up in the diff objective by objective. */
function serialise({ sourceId, sha256, entries }: TextFile): string {
  const lines = entries.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
  return `{\n  "sourceId": ${JSON.stringify(sourceId)},\n  "sha256": ${JSON.stringify(sha256)},\n  "entries": [\n${lines}\n  ]\n}\n`;
}

await mkdir(`${import.meta.dir}/texts`, { recursive: true });
for (const source of PROGRAMME_SOURCES) {
  const { file, formulas } = await extract(source);
  await Bun.write(`${import.meta.dir}/texts/${source.id}.json`, serialise(file));
  const levels = Object.entries(Object.groupBy(file.entries, (e) => e.level)).map(([level, list]) => `${level} ${String(list.length)}`);
  console.log(`${source.id}: ${String(file.entries.length)} entries (${levels.join(', ')}); formulas to check: ${formulas.map((e) => `${e.id} p${String(e.page)}`).join(', ') || 'none'}`);
}
