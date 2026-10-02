import { joinRuns, type Block, type PositionedText } from './parse.js';

/** The parts of pdf.js text content and structure tree the extraction reads. */
export type TextContentItem =
  | { str: string; transform: unknown[]; width: number; height: number; hasEOL: boolean }
  | { type: string; id: string };
export interface StructNode {
  role: string;
  children: (StructNode | { type: string; id: string })[];
}

const BLOCK_ROLES = new Set(['H1', 'H2', 'H3', 'H4', 'P']);
const SKIPPED_ROLES = new Set(['TOC', 'Figure', 'Lbl']);

function isNode(child: StructNode['children'][number]): child is StructNode {
  return 'role' in child;
}

/** Text runs of each marked-content id; nested marked content belongs to its parent id. */
export function runsById(items: readonly TextContentItem[]): Map<string, PositionedText[]> {
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

function cells(node: StructNode): StructNode[] {
  return node.children.filter(isNode).flatMap((child) => (child.role === 'TD' || child.role === 'TH' ? [child] : cells(child)));
}

function contentIds(node: StructNode): string[] {
  return node.children.flatMap((child) => {
    if (isNode(child)) return SKIPPED_ROLES.has(child.role) ? [] : contentIds(child);
    return child.type === 'content' ? [child.id] : [];
  });
}

/**
 * Headings, paragraphs, list items and tables of one page in reading order. A list item
 * keeps its nested lists; a table is one block, its cells separated by spaces; tables of
 * contents, figures and list labels are skipped.
 */
export function pageBlocks(tree: StructNode, runs: Map<string, PositionedText[]>, page: number): Block[] {
  const blocks: Block[] = [];
  const emit = (role: Block['role'], node: StructNode) => {
    const { text, formula } = joinRuns(contentIds(node).flatMap((id) => runs.get(id) ?? []));
    if (text) blocks.push({ role, text, page, formula });
  };
  const walk = (node: StructNode) => {
    if (SKIPPED_ROLES.has(node.role)) return;
    if (BLOCK_ROLES.has(node.role)) emit(node.role as Block['role'], node);
    else if (node.role === 'LI') emit('LI', node);
    else if (node.role === 'Table') {
      const cellText = cells(node).map((cell) => joinRuns(contentIds(cell).flatMap((id) => runs.get(id) ?? [])).text).filter(Boolean);
      if (cellText.length > 0) blocks.push({ role: 'TABLE', text: cellText.join(' '), page, formula: false });
    } else node.children.filter(isNode).forEach(walk);
  };
  walk(tree);
  return blocks;
}

/**
 * The plain page text and an entry compared on everything but spacing, the slash of a
 * rebuilt fraction, superscripts (read as digits), bullets and dashes, which serve both as
 * list labels and as minus signs in the page text.
 */
export function canonical(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\s/—–−•-]/gu, '');
}

/** Plain text of a page, straight from its text runs, without the structure tree. */
export function plainText(items: readonly TextContentItem[]): string {
  return canonical(items.map((item) => ('str' in item ? item.str : '')).join(''));
}
