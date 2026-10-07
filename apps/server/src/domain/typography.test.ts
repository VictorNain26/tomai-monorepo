import { describe, expect, it } from 'bun:test';
import { plainTypography } from './typography';

describe('plainTypography', () => {
  it('reads KaTeX commands, products and brackets past', () => {
    expect(plainTypography('$\\text{BC} = 3 \\times 4$')).toBe(' BC = 3 × 4 ');
    expect(plainTypography('\\(12 \\div 4\\)')).toBe(' 12 ÷ 4 ');
    expect(plainTypography('\\left( 2 \\cdot 3 \\right)')).toBe('( 2 × 3 )');
  });

  it('unifies French typography: decimal comma, dashes, apostrophes, thin spaces, emphasis', () => {
    expect(plainTypography('0{,}05 et 7,5')).toBe('0.05 et 7.5');
    expect(plainTypography('−3 – 2')).toBe('-3 - 2');
    expect(plainTypography('s’ouvrit')).toBe("s'ouvrit");
    expect(plainTypography('200 000 et **10**')).toBe('200 000 et 10');
  });

  it('leaves a comma between words alone', () => {
    expect(plainTypography('Oui, 3, puis 4')).toBe('Oui, 3, puis 4');
  });
});
