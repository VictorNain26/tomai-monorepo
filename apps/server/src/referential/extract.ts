/**
 * `bun run referential:extract`: downloads each official PDF, checks its pinned SHA-256,
 * reads its structure tree with pdf.js and writes `texts/<source id>.json`. The run fails
 * if a text for one class names another class in its banner, if a block of a list finds no
 * class or domain, or if an entry is not found, letters, digits and symbols in order, in
 * the plain text of its page.
 */
import { mkdir } from 'node:fs/promises';
import { getDocumentProxy } from 'unpdf';
import { parseBlocks, type Block, type ParseResult } from './parse.js';
import { canonical, pageBlocks, plainText, runsById } from './pdf-blocks.js';
import { PROGRAMME_SOURCES, type ProgrammeSource } from './sources.js';
import type { Entry, TextFile } from './schema.js';

async function extract(source: ProgrammeSource): Promise<{ file: TextFile; formulas: Entry[]; leftOut: ParseResult['leftOut'] }> {
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
    const { items } = await page.getTextContent({ includeMarkedContent: true });
    plain.push(plainText(items));
    blocks.push(...pageBlocks(await page.getStructTree(), runsById(items), number));
  }

  const { entries, dropped, leftOut, declaredLevels } = parseBlocks(blocks, source);
  if (source.level && (declaredLevels.length === 0 || declaredLevels.some((level) => level !== source.level))) {
    throw new Error(`${source.id}: the banner names ${declaredLevels.join(', ') || 'no class'}, not ${source.level}`);
  }
  if (dropped.length > 0) {
    throw new Error(
      `${source.id}: list blocks without class or domain: ${dropped.map((b) => `p${String(b.page)} « ${b.text.slice(0, 60)} »`).join('; ')}`,
    );
  }
  const missing = entries.filter((entry) => !`${plain[entry.page - 1] ?? ''}${plain[entry.page] ?? ''}`.includes(canonical(entry.text)));
  if (missing.length > 0) {
    throw new Error(`${source.id}: not found in the page text: ${missing.map((e) => `${e.id} « ${e.text.slice(0, 60)} »`).join('; ')}`);
  }
  return { file: { sourceId: source.id, sha256, entries }, formulas: entries.filter((e) => e.formula), leftOut };
}

/** One entry per line: a new BO shows up in the diff objective by objective. */
function serialise({ sourceId, sha256, entries }: TextFile): string {
  const lines = entries.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
  return `{\n  "sourceId": ${JSON.stringify(sourceId)},\n  "sha256": ${JSON.stringify(sha256)},\n  "entries": [\n${lines}\n  ]\n}\n`;
}

await mkdir(`${import.meta.dir}/texts`, { recursive: true });
for (const source of PROGRAMME_SOURCES) {
  const { file, formulas, leftOut } = await extract(source);
  await Bun.write(`${import.meta.dir}/texts/${source.id}.json`, serialise(file));
  const levels = Object.entries(Object.groupBy(file.entries, (e) => e.level)).map(([level, list]) => `${level} ${String(list.length)}`);
  console.log(`${source.id}: ${String(file.entries.length)} entries (${levels.join(', ')})`);
  for (const entry of formulas) console.log(`  formula to check, p${String(entry.page)}: ${entry.text}`);
  for (const { block, reason } of leftOut) console.log(`  left out (${reason}), p${String(block.page)}: ${block.text}`);
}
