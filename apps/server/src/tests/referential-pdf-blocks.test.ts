import { describe, it, expect } from 'bun:test';
import { canonical, pageBlocks, plainText, runsById, type StructNode, type TextContentItem } from '../referential/pdf-blocks';

function text(str: string, x = 0, y = 100): TextContentItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: 3, height: 8.5, hasEOL: false };
}

const items: TextContentItem[] = [
  { type: 'beginMarkedContentProps', id: 'c1' },
  text('Cinquième'),
  { type: 'endMarkedContent', id: '' },
  { type: 'beginMarkedContentProps', id: 'c2' },
  text('−'),
  { type: 'endMarkedContent', id: '' },
  { type: 'beginMarkedContentProps', id: 'c3' },
  text('Lire '),
  { type: 'beginMarkedContent', id: '' },
  text('vite'),
  { type: 'endMarkedContent', id: '' },
  text('.'),
  { type: 'endMarkedContent', id: '' },
  { type: 'beginMarkedContentProps', id: 'c4' },
  text('Alexis'),
  { type: 'endMarkedContent', id: '' },
  { type: 'beginMarkedContentProps', id: 'c5' },
  text('6'),
  { type: 'endMarkedContent', id: '' },
  text('page 3'),
];

const tree: StructNode = {
  role: 'Root',
  children: [{
    role: 'Document',
    children: [
      { role: 'TOC', children: [{ type: 'content', id: 'c1' }] },
      { role: 'H1', children: [{ type: 'content', id: 'c1' }] },
      { role: 'L', children: [{ role: 'LI', children: [{ role: 'Lbl', children: [{ type: 'content', id: 'c2' }] }, { role: 'LBody', children: [{ type: 'content', id: 'c3' }] }] }] },
      { role: 'Table', children: [{ role: 'TR', children: [{ role: 'TD', children: [{ type: 'content', id: 'c4' }] }, { role: 'TD', children: [{ type: 'content', id: 'c5' }] }] }] },
    ],
  }],
};

describe('runsById', () => {
  it('maps text runs to their marked-content id, nested marked content to its parent, untagged text nowhere', () => {
    const runs = runsById(items);
    expect(runs.get('c3')?.map((r) => r.str)).toEqual(['Lire ', 'vite', '.']);
    expect([...runs.values()].flat().some((r) => r.str === 'page 3')).toBe(false);
  });
});

describe('pageBlocks', () => {
  it('reads headings, list items without their label and tables as one block, skipping tables of contents', () => {
    expect(pageBlocks(tree, runsById(items), 7)).toEqual([
      { role: 'H1', text: 'Cinquième', page: 7, formula: false },
      { role: 'LI', text: 'Lire vite.', page: 7, formula: false },
      { role: 'TABLE', text: 'Alexis 6', page: 7, formula: false },
    ]);
  });
});

describe('pageBlocks banners', () => {
  it('reads the alternative text of a paragraph without text, and of a table before its cells', () => {
    const bannerTree: StructNode = {
      role: 'Root',
      children: [{
        role: 'Part',
        children: [
          { role: 'P', children: [{ role: 'Span', alt: 'Attendus de ', children: [] }, { role: 'Span', alt: 'fin de 4', children: [] }, { role: 'Span', alt: 'e', children: [] }] },
          { role: 'Table', children: [{ role: 'TR', children: [{ role: 'TD', children: [{ role: 'P', children: [{ role: 'Span', alt: 'Nombres et calculs', children: [] }] }, { type: 'content', id: 'c4' }] }] }] },
        ],
      }],
    };
    expect(pageBlocks(bannerTree, runsById(items), 1).map(({ role, text }) => ({ role, text }))).toEqual([
      { role: 'BANNER', text: 'Attendus de fin de 4e' },
      { role: 'BANNER', text: 'Nombres et calculs' },
      { role: 'TABLE', text: 'Alexis' },
    ]);
  });
});

describe('canonical and plainText', () => {
  it('compare everything but spacing, rebuilt slashes, superscripts, bullets and dashes', () => {
    expect(canonical('1/2 ; 2³ = 8 • − lire')).toBe('12;23=8lire');
    expect(plainText(items)).toContain(canonical('Lire vite.'));
    expect(plainText(items)).not.toContain(canonical('Lire lentement.'));
  });
});
