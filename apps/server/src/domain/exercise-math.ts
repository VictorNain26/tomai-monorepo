/**
 * What mathjs can establish about an exercise's answer (`docs/etudes/2026-10-04/refonte-agent.md`,
 * « mathjs vérifie les calculs »). mathjs has no general `solve`, and `symbolicEqual` may say
 * `false` of two equal expressions. Two equations in one unknown of degree 3 at most compare by
 * the roots of « left − right » (`rationalize`, then `polynomialRoot`). Two expressions compare by
 * their values at fixed points: `rationalize` does not reduce a difference in several letters to
 * zero (« (a+b)^2 » against its expansion), while two different rational expressions agree at a
 * handful of points only by accident. Anything else is out of reach, and says so with `null`.
 */

import {
  isConstantNode,
  isOperatorNode,
  isParenthesisNode,
  isSymbolNode,
  parse,
  polynomialRoot,
  rationalize,
  type Complex,
  type MathNode,
  type MathType,
} from 'mathjs';

// Relative: the roots of a cubic come out of floating point.
const EPSILON = 1e-7;
// The forms come from a model that read the student's text: bounded before mathjs expands them.
const MAX_LENGTH = 120;
const MAX_NODES = 60;
const MAX_POWER = 3;
const OPERATORS = new Set(['+', '-', '*', '/', '^']);
// Away from the small integers where a denominator of an exercise would vanish.
const POINTS = [1.37, -2.61, 0.73, 3.19];

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Numbers, one-letter unknowns, the four operations and powers up to 3: or null. */
function readable(expression: string): MathNode | null {
  if (expression.length > MAX_LENGTH) return null;
  let node: MathNode;
  try {
    node = parse(expression);
  } catch {
    return null;
  }
  const nodes = node.filter(() => true);
  const allowed = nodes.every((child) => {
    if (isConstantNode(child)) return typeof child.value === 'number';
    if (isSymbolNode(child)) return /^[a-z]$/i.test(child.name);
    if (isParenthesisNode(child)) return true;
    if (!isOperatorNode(child) || !OPERATORS.has(child.op)) return false;
    if (child.op !== '^') return true;
    const exponent = child.args[1];
    return (
      exponent !== undefined && isConstantNode(exponent) && Number.isInteger(exponent.value) && exponent.value >= 0 && exponent.value <= MAX_POWER
    );
  });
  return allowed && nodes.length <= MAX_NODES ? node : null;
}

function valueAt(node: MathNode, scope: Record<string, number>): number | null {
  try {
    const value: unknown = node.evaluate(scope);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * An upper bound of the degree a node expands to. The bounds above keep each power at 3, not a
 * product of powers: « (x+1)^3*(x+1)^3 » kept `rationalize` busy past 20 s, the event loop with it.
 */
function degree(node: MathNode): number {
  if (isConstantNode(node)) return 0;
  if (isSymbolNode(node)) return 1;
  if (isParenthesisNode(node)) return degree(node.content);
  if (!isOperatorNode(node)) return Infinity;
  const degrees = node.args.map(degree);
  if (node.op === '^') {
    const [base = Infinity] = degrees;
    const exponent = node.args[1];
    return exponent && isConstantNode(exponent) ? base * exponent.value : Infinity;
  }
  // A product, and a quotient once its denominator is multiplied through, add their degrees.
  if (node.op === '*' || node.op === '/') return degrees.reduce((sum, d) => sum + d, 0);
  return Math.max(0, ...degrees);
}

function sides(equation: string): [MathNode, MathNode] | null {
  const parts = equation.split('=');
  const [left, right] = parts;
  if (parts.length !== 2 || left === undefined || right === undefined) return null;
  const l = readable(left);
  const r = readable(right);
  return l && r && degree(l) <= MAX_POWER && degree(r) <= MAX_POWER ? [l, r] : null;
}

function realRoot(root: number | Complex): number | null {
  if (typeof root === 'number') return root;
  return Math.abs(root.im) < EPSILON ? root.re : null;
}

/** The real roots of an equation in one unknown of degree 1 to 3, sorted, or null. */
export function equationRoots(equation: string): { unknown: string; roots: number[] } | null {
  const both = sides(equation);
  if (!both) return null;
  let result: { expression: MathNode | string; variables: string[]; coefficients: MathType[] };
  try {
    result = rationalize(`(${both[0].toString()}) - (${both[1].toString()})`, {}, true);
  } catch {
    return null;
  }
  const [unknown, ...others] = result.variables;
  const node = typeof result.expression === 'string' ? parse(result.expression) : result.expression;
  const dividesByUnknown = node.filter((child) => isOperatorNode(child) && child.op === '/' && (child.args[1]?.filter(isSymbolNode).length ?? 0) > 0);
  const coefficients = result.coefficients.filter((c): c is number => typeof c === 'number');
  if (unknown === undefined || others.length > 0 || dividesByUnknown.length > 0 || coefficients.length !== result.coefficients.length) return null;
  while (coefficients.length > 0 && Math.abs(coefficients.at(-1) ?? 0) < EPSILON) coefficients.pop();
  const [c0 = 0, c1, ...higher] = coefficients;
  if (c1 === undefined || higher.length > 2) return null;
  const roots = polynomialRoot(c0, c1, ...higher)
    .map(realRoot)
    .filter((root): root is number => root !== null)
    .sort((a, b) => a - b)
    .filter((root, i, all) => i === 0 || !close(root, all[i - 1] ?? root));
  return { unknown, roots };
}

function sameRoots(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((root, i) => close(root, b[i] ?? Infinity));
}

const unknownsOf = (node: MathNode) => node.filter(isSymbolNode).map((symbol) => (isSymbolNode(symbol) ? symbol.name : ''));

function sameExpression(a: MathNode, b: MathNode): boolean | null {
  const unknowns = [...new Set([...unknownsOf(a), ...unknownsOf(b)])];
  for (const [i] of POINTS.entries()) {
    const scope = Object.fromEntries(unknowns.map((name, j) => [name, (POINTS[(i + j) % POINTS.length] ?? 1) + j * 0.11]));
    const va = valueAt(a, scope);
    const vb = valueAt(b, scope);
    if (va === null || vb === null) return null;
    if (!close(va, vb)) return false;
  }
  return true;
}

type Roots = NonNullable<ReturnType<typeof equationRoots>>;

/** Whether an answer has the given roots: an equation with the same unknown and roots, or the value of the only root. */
function matchesRoots(roots: Roots, answer: string): boolean | null {
  if (answer.includes('=')) {
    const other = equationRoots(answer);
    return other ? roots.unknown === other.unknown && sameRoots(roots.roots, other.roots) : null;
  }
  const node = readable(answer);
  const value = node && unknownsOf(node).length === 0 ? valueAt(node, {}) : null;
  return value === null ? null : sameRoots(roots.roots, [value]);
}

/**
 * Whether two answers are the same for mathjs: two equations with the same unknown and roots, an
 * equation and the value of its only root, or two expressions equal at every point. Null when
 * mathjs cannot tell.
 */
export function sameMath(a: string, b: string): boolean | null {
  const equation = a.includes('=') ? a : b.includes('=') ? b : null;
  if (equation !== null) {
    const roots = equationRoots(equation);
    return roots ? matchesRoots(roots, equation === a ? b : a) : null;
  }
  const na = readable(a);
  const nb = readable(b);
  return na && nb ? sameExpression(na, nb) : null;
}

export type MathCheck = 'passed' | 'failed' | 'not-applicable';

/** The answer checked against the statement's equation, its roots computed once: an equation must have its roots, a value must be its only root. */
export function checkAnswer(equation: string, answer: string): MathCheck {
  const roots = equationRoots(equation);
  if (!roots) return 'not-applicable';
  const same = matchesRoots(roots, answer);
  return same === null ? 'not-applicable' : same ? 'passed' : 'failed';
}
