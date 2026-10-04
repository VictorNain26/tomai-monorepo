/**
 * What mathjs can establish about an exercise's answer (`docs/etudes/2026-10-04/refonte-agent.md`,
 * « mathjs vérifie les calculs »). mathjs has no general `solve`, and `symbolicEqual` may say
 * `false` of two equal expressions: two expressions compare by `rationalize` of their difference,
 * two equations in one unknown of degree 3 at most by the roots of « left − right ». Anything
 * else is out of reach, and says so with `null`.
 */

import { evaluate, isOperatorNode, isSymbolNode, parse, polynomialRoot, rationalize, type Complex, type MathNode, type MathType } from 'mathjs';

// Loose enough for the roots of a cubic, which polynomialRoot computes in floating point.
const EPSILON = 1e-7;

interface Polynomial {
  variables: string[];
  /** Constant first; empty for a constant expression. */
  coefficients: number[];
  /** The rationalized expression, read for a constant. */
  expression: string;
}

/** `expression` as a polynomial in one unknown at most, or null when mathjs cannot read it so. */
function polynomial(expression: string): Polynomial | null {
  let result: { expression: MathNode | string; variables: string[]; coefficients: MathType[] };
  try {
    result = rationalize(expression, {}, true);
  } catch {
    return null;
  }
  const node = typeof result.expression === 'string' ? parse(result.expression) : result.expression;
  const dividesByUnknown = node.filter((child) => isOperatorNode(child) && child.op === '/' && (child.args[1]?.filter(isSymbolNode).length ?? 0) > 0);
  if (dividesByUnknown.length > 0 || result.variables.length > 1) return null;
  const coefficients = result.coefficients.filter((c): c is number => typeof c === 'number');
  if (coefficients.length !== result.coefficients.length) return null;
  return { variables: result.variables, coefficients, expression: node.toString() };
}

function isZero(p: Polynomial): boolean {
  if (p.variables.length > 0) return p.coefficients.every((c) => Math.abs(c) < EPSILON);
  const value = numericValue(p.expression);
  return value !== null && Math.abs(value) < EPSILON;
}

function sides(equation: string): [string, string] | null {
  const parts = equation.split('=');
  const [left, right] = parts;
  return parts.length === 2 && left?.trim() && right?.trim() ? [left, right] : null;
}

function realRoot(root: number | Complex): number | null {
  if (typeof root === 'number') return root;
  return Math.abs(root.im) < EPSILON ? root.re : null;
}

/** The real roots of an equation in one unknown of degree 1 to 3, sorted, or null. */
export function equationRoots(equation: string): { unknown: string; roots: number[] } | null {
  const both = sides(equation);
  if (!both) return null;
  const p = polynomial(`(${both[0]}) - (${both[1]})`);
  const [unknown] = p?.variables ?? [];
  if (!p || unknown === undefined) return null;
  const coefficients = [...p.coefficients];
  while (coefficients.length > 0 && Math.abs(coefficients.at(-1) ?? 0) < EPSILON) coefficients.pop();
  const [c0 = 0, c1, ...higher] = coefficients;
  if (c1 === undefined || higher.length > 2) return null;
  const roots = polynomialRoot(c0, c1, ...higher)
    .map(realRoot)
    .filter((root): root is number => root !== null)
    .sort((a, b) => a - b)
    .filter((root, i, all) => i === 0 || Math.abs(root - (all[i - 1] ?? root)) > EPSILON);
  return { unknown, roots };
}

function sameRoots(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((root, i) => Math.abs(root - (b[i] ?? Infinity)) < EPSILON);
}

function numericValue(expression: string): number | null {
  try {
    const value: unknown = evaluate(expression);
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Whether two answers are the same for mathjs: two equations with the same unknown and roots, an
 * equation and the value of its only root, or two expressions whose difference is zero. Null when
 * mathjs cannot tell.
 */
export function sameMath(a: string, b: string): boolean | null {
  const aIsEquation = a.includes('=');
  if (aIsEquation !== b.includes('=')) {
    const roots = equationRoots(aIsEquation ? a : b);
    const value = numericValue(aIsEquation ? b : a);
    return roots && value !== null ? sameRoots(roots.roots, [value]) : null;
  }
  if (aIsEquation) {
    const ra = equationRoots(a);
    const rb = equationRoots(b);
    if (!ra || !rb) return null;
    return ra.unknown === rb.unknown && sameRoots(ra.roots, rb.roots);
  }
  const difference = polynomial(`(${a}) - (${b})`);
  return difference ? isZero(difference) : null;
}

export type MathCheck = 'passed' | 'failed' | 'not-applicable';

/** The answer checked against the statement's equation: an equation must have its roots, a value must be its only root. */
export function checkAnswer(equation: string, answer: string): MathCheck {
  if (!equationRoots(equation)) return 'not-applicable';
  const same = sameMath(equation, answer);
  return same === null ? 'not-applicable' : same ? 'passed' : 'failed';
}
