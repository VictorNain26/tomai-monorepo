import { describe, expect, it } from 'bun:test';
import { unreadableMathAsText } from './math';

const tree = () => ({
  type: 'root',
  children: [
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Que vaut ' },
        { type: 'inlineMath', value: '\\frac{3}{4}' },
        { type: 'inlineMath', value: '\\frac{3}{' },
      ],
    },
    { type: 'math', value: '\\frac{1}{' },
  ],
});

describe('unreadableMathAsText', () => {
  it('keeps a formula KaTeX reads, and gives back as text, dollars included, one it cannot', () => {
    const root = tree();
    unreadableMathAsText()(root);
    expect(root.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Que vaut ' },
          { type: 'inlineMath', value: '\\frac{3}{4}' },
          { type: 'text', value: '$\\frac{3}{$' },
        ],
      },
      { type: 'paragraph', children: [{ type: 'text', value: '$$\\frac{1}{$$' }] },
    ]);
  });
});
