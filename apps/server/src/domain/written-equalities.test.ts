import { describe, expect, it } from 'bun:test';
import { isWrong, writtenEqualities, wrongEqualities } from './written-equalities';

describe('writtenEqualities', () => {
  const found = (text: string) => writtenEqualities(text).map((e) => [e.left, e.right, isWrong(e)]);

  it('finds numeric equalities and recomputes them', () => {
    expect(found('Par exemple, 2 + 3 × 4 = 20.')).toEqual([['2 + 3 * 4', '20', true]]);
    expect(found('15 ÷ 3 = 5 et 4,50 × 2 = 9')).toEqual([
      ['15 / 3', '5', false],
      ['4.50 * 2', '9', false],
    ]);
    expect(found('1 000 × 2 = 2 500')).toEqual([['1000 * 2', '2500', true]]);
  });

  it('reads signs, powers, chains, fractions, money, units and list numbers', () => {
    expect(found('−3 + 5 = 2')).toEqual([['-3 + 5', '2', false]]);
    expect(found('soit -3 + 5 = 2')).toEqual([['-3 + 5', '2', false]]);
    expect(found('Donc 3 × 4 = 11.')).toEqual([['3 * 4', '11', true]]);
    expect(found('2² + 3 + 4 = 11')).toEqual([['2^2 + 3 + 4', '11', false]]);
    expect(found('10 – 2 × 3 = 10 – 6 = 4')).toEqual([
      ['10 - 2 * 3', '10 - 6', false],
      ['10 - 6', '4', false],
    ]);
    expect(found('\\(\\frac{20}{3} = 6{,}67\\)')).toEqual([['(20)/(3)', '6.67', false]]);
    expect(found('3 × 1,50 € = 4,50 €')).toEqual([['3 * 1.50', '4.50', false]]);
    expect(found('4 × 3 = 13 cm')).toEqual([['4 * 3', '13', true]]);
    expect(found('2. 3 × 4 = 12')).toEqual([['3 * 4', '12', false]]);
    expect(found('- 3 × 5 = 15')).toEqual([['3 * 5', '15', false]]);
    expect(found('  * 3 × 5 = 15')).toEqual([['3 * 5', '15', false]]);
    // A minus sign in KaTeX or typographic is no bullet, even followed by a space.
    expect(found('$- 4 + 6 = 2$')).toEqual([['- 4 + 6', '2', false]]);
    expect(found('\\(- 4 + 6 = 2\\)')).toEqual([['- 4 + 6', '2', false]]);
    expect(found('− 3 + 5 = 2')).toEqual([['- 3 + 5', '2', false]]);
  });

  it('reads a KaTeX division and a calculation after a sentence', () => {
    expect(found('$12 \\div 4 = 3$')).toEqual([['12 / 4', '3', false]]);
    expect(found('Bravo. 2 + 3 × 4 = 20')).toEqual([['2 + 3 * 4', '20', true]]);
    expect(found('Le total : 4 500 euros = 4 × 1 125')).toEqual([['4500', '4 * 1125', false]]);
  });

  it('leaves alone a calculation after a word it cannot read: operator, quantity, unit, term', () => {
    expect(found('3 fois 4 = 12')).toEqual([]);
    expect(found('10 % de 200 = 20')).toEqual([]);
    expect(found('Les 3/4 de 20 = 15')).toEqual([]);
    expect(found('2 h 15 = 135 min')).toEqual([]);
    expect(found('2 ab - 1 = 5')).toEqual([]);
    expect(found('le prix - 3 = 7')).toEqual([]);
  });

  it('does not join a result with a number that a word follows', () => {
    expect(found('On a 2 + 3 = 5 100 fois')).toEqual([]);
  });

  it('keeps each line apart', () => {
    expect(found('Étape 1\n2 + 3 = 6')).toEqual([['2 + 3', '6', true]]);
  });

  it('leaves alone what involves an unknown, a function or a formula in letters', () => {
    expect(found('On résout x + 2 × 3 = 10')).toEqual([]);
    expect(found('3x + 5 − 5 = 20 − 5')).toEqual([]);
    expect(found('x - 3 = 2')).toEqual([]);
    expect(found('15x = 30')).toEqual([]);
    expect(found('U = R × I. R = 220 Ω')).toEqual([]);
    expect(found('f(4) = 3 × 4 − 2 = 10')).toEqual([['3 * 4 - 2', '10', false]]);
  });
});

describe('isWrong', () => {
  it('accepts a result rounded to the precision it is written with', () => {
    expect(isWrong({ left: '20 / 3', right: '6.67' })).toBe(false);
    expect(isWrong({ left: '20 / 3', right: '6.6' })).toBe(true);
    expect(isWrong({ left: '20 / 3', right: '6.70' })).toBe(true);
  });

  it('wants a whole result exact', () => {
    expect(isWrong({ left: '7 / 2', right: '3' })).toBe(true);
    expect(isWrong({ left: '7 * 0.5', right: '3' })).toBe(true);
    expect(isWrong({ left: '12 / 4', right: '3' })).toBe(false);
  });
});

describe('wrongEqualities', () => {
  it('returns the wrong equalities of a text, once each', () => {
    expect(wrongEqualities('2 + 3 × 4 = 20, je répète : 2 + 3 × 4 = 20. Et 3 × 4 = 12.', []).map((e) => e.quote)).toEqual(['2 + 3 * 4 = 20']);
  });

  it('leaves alone the student work shown back, their « fois » read as a product', () => {
    expect(wrongEqualities('Tu as écrit : 3 × 4 = 13, recompte.', ["j'ai trouvé 3 × 4 = 13"])).toEqual([]);
    expect(wrongEqualities('Tu as écrit : 3 × 4 = 13.', ['3 fois 4 = 13'])).toEqual([]);
    expect(wrongEqualities('Tu as écrit : 3 × 4 = 13.', ['5 × 4 = 21']).map((e) => e.quote)).toEqual(['3 * 4 = 13']);
  });
});
