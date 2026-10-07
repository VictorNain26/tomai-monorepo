import { describe, it, expect } from 'bun:test';
import { checkAnswer, compareEquations, equationRoots, sameMath } from './exercise-math';

describe('equationRoots', () => {
  it('reads the real roots of an equation in one unknown, degree 1 to 3', () => {
    expect(equationRoots('3x + 5 = 20')).toEqual({ unknown: 'x', roots: [5] });
    expect(equationRoots('x^2 - 5x + 6 = 0')?.roots).toEqual([2, 3]);
    expect(equationRoots('x^2 + 1 = 0')?.roots).toEqual([]);
    expect(equationRoots('x^3 = 8')?.roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([2]);
  });

  it('gives up on what it cannot read: two unknowns, degree 4, no unknown, a fraction of the unknown, no equation', () => {
    expect(equationRoots('x + y = 3')).toBeNull();
    expect(equationRoots('x^4 = 16')).toBeNull();
    expect(equationRoots('2 + 3 = 5')).toBeNull();
    expect(equationRoots('1 / x = 2')).toBeNull();
    expect(equationRoots('3x + 5')).toBeNull();
    expect(equationRoots('x = = 2')).toBeNull();
  });
});

describe('sameMath', () => {
  it('compares two equations by their roots, as the study tried it', () => {
    expect(sameMath('2x + 3 = 7', '2x = 4')).toBe(true);
    expect(sameMath('2x + 3 = 7', '2x = 10')).toBe(false);
    expect(sameMath('x = 2', 'y = 2')).toBe(false);
  });

  it('compares two expressions by their difference', () => {
    expect(sameMath('3/4', '0.75')).toBe(true);
    expect(sameMath('6/8', '3/4')).toBe(true);
    expect(sameMath('2(x + 1)', '2x + 2')).toBe(true);
    expect(sameMath('2(x + 1)', '2x + 1')).toBe(false);
    expect(sameMath('3.14', '3.15')).toBe(false);
  });

  it('compares expressions in several letters, which rationalize does not reduce', () => {
    expect(sameMath('(a + b)^2', 'a^2 + 2*a*b + b^2')).toBe(true);
    expect(sameMath('(a + b)^2', 'a^2 + b^2')).toBe(false);
    expect(sameMath('x / (x + 1)', '1 - 1 / (x + 1)')).toBe(true);
  });

  it('refuses what it should not expand or run: big powers, functions, matrices, long input', () => {
    expect(sameMath('(x + 1)^400', 'x')).toBeNull();
    expect(sameMath('ones(20000, 20000)', '1')).toBeNull();
    expect(sameMath('sqrt(2)', '1.41')).toBeNull();
    expect(sameMath(`${'x + '.repeat(40)}1`, 'x')).toBeNull();
    expect(equationRoots('(x + 1)^400 = 0')).toBeNull();
  });

  it('refuses a product of powers past degree 3 before expanding it, which would block the server', () => {
    const start = Date.now();
    expect(equationRoots('(x+1)^3*(x+1)^3=0')).toBeNull();
    expect(equationRoots('(x+1)^3*(x+1)^2=0')).toBeNull();
    expect(equationRoots('(x+y)^3*(x+y)^3=0')).toBeNull();
    expect(equationRoots('x^2 / x^2 = 1')).toBeNull();
    expect(Date.now() - start).toBeLessThan(100);
    expect(equationRoots('(x+1)*(x-2)*(x+3) = 0')?.roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([-3, -1, 2]);
  });

  it('compares large roots relatively', () => {
    expect(sameMath('x^3 = 8000000', 'x = 200')).toBe(true);
  });

  it('compares an equation and a value by its only root', () => {
    expect(sameMath('x = 5', '5')).toBe(true);
    expect(sameMath('15/3', 'x = 5')).toBe(true);
    expect(sameMath('x^2 = 4', '2')).toBe(false);
    expect(sameMath('x = 5', 'x + 1')).toBeNull();
  });

  it('cannot read words', () => {
    expect(sameMath('le sujet', 'le verbe')).toBeNull();
  });
});

describe('compareEquations', () => {
  it('tells the statement written back, the same roots, part of them and other roots', () => {
    expect(compareEquations('3*x + 5 = 20', '3*x + 5 = 20')).toBe('restated');
    expect(compareEquations('3x+5=20', '3*x + 5 = 20')).toBe('restated');
    expect(compareEquations('3*x = 15', '3*x + 5 = 20')).toBe('same');
    expect(compareEquations('x = 2', 'x^2 = 4')).toBe('part');
    expect(compareEquations('x = 3', 'x^2 = 4')).toBe('different');
  });

  it('cannot tell when the unknowns differ or mathjs cannot read', () => {
    expect(compareEquations('x = 5', '3*n + 5 = 20')).toBeNull();
    expect(compareEquations('x = cinq', '3*x + 5 = 20')).toBeNull();
  });
});

describe('checkAnswer', () => {
  it('passes an answer that solves the equation, written as a value or as an equation', () => {
    expect(checkAnswer('3x + 5 = 20', '5')).toBe('passed');
    expect(checkAnswer('3x + 5 = 20', 'x = 5')).toBe('passed');
    expect(checkAnswer('3x + 5 = 20', '15/3')).toBe('passed');
  });

  it('fails a wrong answer, and a single value for an equation with two roots', () => {
    expect(checkAnswer('3x + 5 = 20', '20/3')).toBe('failed');
    expect(checkAnswer('3x + 5 = 20', 'x = 25/3')).toBe('failed');
    expect(checkAnswer('x^2 = 4', '2')).toBe('failed');
  });

  it('does not judge what it cannot read', () => {
    expect(checkAnswer('x + y = 3', '1')).toBe('not-applicable');
    expect(checkAnswer('3x + 5 = 20', 'x = 5 ou x = 6')).toBe('not-applicable');
    expect(checkAnswer('3x + 5 = 20', 'cinq')).toBe('not-applicable');
  });
});
