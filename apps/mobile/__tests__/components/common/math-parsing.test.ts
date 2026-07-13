import {
  containsMath,
  parseContent,
  normalizeMathDelimiters,
} from '@/components/common/math-parsing';

describe('normalizeMathDelimiters', () => {
  it('converts inline \\(…\\) to $…$', () => {
    expect(normalizeMathDelimiters('aire \\(x + 1\\) fin')).toBe('aire $x + 1$ fin');
  });

  it('converts block \\[…\\] to $$…$$', () => {
    expect(normalizeMathDelimiters('\\[a^2 + b^2\\]')).toBe('$$a^2 + b^2$$');
  });

  it('leaves existing $…$ / $$…$$ untouched', () => {
    expect(normalizeMathDelimiters('inline $x$ and block $$y$$')).toBe('inline $x$ and block $$y$$');
  });

  it('does not convert delimiters inside a fenced code block', () => {
    const input = 'texte\n```\nprint("\\(x\\)")\n```\nsuite';
    expect(normalizeMathDelimiters(input)).toBe(input);
  });

  it('does not convert delimiters inside inline code', () => {
    expect(normalizeMathDelimiters('le code `\\(x\\)` reste brut')).toBe('le code `\\(x\\)` reste brut');
  });

  it('is a no-op on text without math', () => {
    expect(normalizeMathDelimiters('bonjour tout le monde')).toBe('bonjour tout le monde');
  });
});

describe('containsMath', () => {
  it('detects backslash-delimited inline math \\(…\\)', () => {
    expect(containsMath('calcul \\(x + 1\\)')).toBe(true);
  });

  it('detects backslash-delimited block math \\[…\\]', () => {
    expect(containsMath('\\[\\frac{1}{2}\\]')).toBe(true);
  });

  it('still detects dollar-delimited math (regression)', () => {
    expect(containsMath('valeur $x + 1$')).toBe(true);
    expect(containsMath('$$\\frac{1}{2}$$')).toBe(true);
  });

  it('detects bare LaTeX commands', () => {
    expect(containsMath('la racine \\sqrt de 2')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsMath('bonjour, comment vas-tu ?')).toBe(false);
  });
});

describe('parseContent', () => {
  it('parses backslash inline math into an inline-math segment', () => {
    const segments = parseContent('la valeur \\(x\\) ici');
    expect(segments).toEqual([
      { type: 'text', content: 'la valeur ' },
      { type: 'inline-math', content: 'x' },
      { type: 'text', content: ' ici' },
    ]);
  });

  it('parses backslash block math into a block-math segment', () => {
    const segments = parseContent('\\[y = 2x\\]');
    expect(segments).toEqual([{ type: 'block-math', content: 'y = 2x' }]);
  });

  it('still parses dollar-delimited math (regression)', () => {
    const segments = parseContent('a $x$ b');
    expect(segments).toEqual([
      { type: 'text', content: 'a ' },
      { type: 'inline-math', content: 'x' },
      { type: 'text', content: ' b' },
    ]);
  });

  it('returns a single text segment when there is no math', () => {
    expect(parseContent('juste du texte')).toEqual([{ type: 'text', content: 'juste du texte' }]);
  });
});
