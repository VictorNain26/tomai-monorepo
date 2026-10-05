import { isConstantNode, isOperatorNode, isParenthesisNode, parse, type MathNode } from 'mathjs';
import { plainTypography } from './typography.js';

/**
 * The equalities a text writes out, read as plain arithmetic, and whether they are wrong: the
 * evaluation harness and the check before the student read them the same way.
 */

/** A numeric equality written out: its two sides as plain arithmetic. */
export interface Equality {
  quote: string;
  left: string;
  right: string;
}

// The characters a written calculation is made of, horizontal spaces only: a line break ends it.
const NUMERIC = '[\\d. +\\-*/^()]';
const NUMERIC_TAIL = new RegExp(`${NUMERIC}+$`);
const NUMERIC_HEAD = new RegExp(`^${NUMERIC}+`);

/**
 * Each line of a text as plain arithmetic: KaTeX, typography, powers, a leading list number or
 * bullet and money read past. Digit groups are joined only when no word follows: « 5 100 fois » may be a
 * result and a count.
 */
function plainLines(text: string): string[] {
  return text.split('\n').map((line) => plainTypography(
    line
      // A Markdown bullet, ASCII and at the head of the raw line: once KaTeX and typography are
      // read past, « $- 4 + 6$ » or « − 3 » would look the same and lose their sign.
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/\s*(?:€|euros?\b)/g, ' ')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .normalize('NFKC')
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
      .replace(/\^\{([^{}]*)\}/g, '^($1)'),
  )
    .replace(/(\d) (?=\d{3}(?!\d|\s*\p{L}))/gu, '$1')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/÷/g, '/')
    .replace(/×/g, '*'));
}

/** A tree of numbers and operators only: no letter, no function, no implicit product (« 2 3 »). */
function arithmetic(expression: string): MathNode | null {
  let node: MathNode;
  try {
    node = parse(expression);
  } catch {
    return null;
  }
  const foreign = node.filter((child) => (isOperatorNode(child) ? child.implicit : !isConstantNode(child) && !isParenthesisNode(child)));
  return foreign.length === 0 ? node : null;
}

// What may stand before a calculation: the start of the line, punctuation or a connective. A
// word may be an operator (« 3 fois 4 »), a quantity (« 10 % de 200 »), a unit (« 2 h 15 ») or
// an unknown (« x - 3 »), which the code cannot read: such a calculation is left alone.
const STANDALONE = /(?:^|[:;,(.!?]|(?<!\p{L})(?:soit|donc|alors|et|puis|ainsi|car))\s*$/iu;

/** The calculation that ends a piece of text, or null when it belongs to something else. */
function trailingCalculation(text: string): string | null {
  const match = NUMERIC_TAIL.exec(text);
  if (!match) return null;
  // A sentence's final dot is punctuation, not part of the calculation (« Bravo. 2 + 3 »).
  const dots = /^[.\s]*/.exec(match[0])?.[0] ?? '';
  const before = text.slice(0, match.index + dots.length);
  const calculation = match[0].slice(dots.length).trim();
  if (!STANDALONE.test(before) || /^[+*/^)]/.test(calculation)) return null;
  return calculation;
}

/** The calculation that starts a piece of text, or null when a letter is glued to it (« 15x »). */
function leadingCalculation(text: string): string | null {
  const match = NUMERIC_HEAD.exec(text);
  if (!match) return null;
  // « 15x » is a term; « 12 cm » a number and its unit.
  if (!/\s$/.test(match[0]) && /^\p{L}/u.test(text.slice(match[0].length))) return null;
  return match[0].trim().replace(/\.+$/, '');
}

/** Numeric equalities written out in a text (« 2 + 3 × 4 = 20 », chains included), found without the model. */
export function writtenEqualities(text: string): Equality[] {
  return plainLines(text).flatMap((line) => {
    const sides = line.split('=');
    return sides.slice(0, -1).flatMap((side, index) => {
      const left = trailingCalculation(side);
      const right = leadingCalculation(sides[index + 1] ?? '');
      if (!left || !right || !arithmetic(left) || !arithmetic(right)) return [];
      return [{ quote: `${left} = ${right}`, left, right }];
    });
  });
}

function decimals(number: string): number {
  return /\.(\d+)\s*$/.exec(number)?.[1]?.length ?? 0;
}

function valueOf(expression: string): number | null {
  const value: unknown = arithmetic(expression)?.evaluate();
  return typeof value === 'number' ? value : null;
}

/**
 * Whether the two sides of an equality differ: a whole result must be exact, a decimal one
 * holds when rounded to the precision it is written with (« 20/3 = 6.67 »).
 */
export function isWrong({ left, right }: Pick<Equality, 'left' | 'right'>): boolean {
  const value = valueOf(left);
  const claimed = valueOf(right);
  if (value === null || claimed === null) return false;
  const places = decimals(right);
  return Math.abs(value - claimed) > (places > 0 ? 0.5 * 10 ** -places : 0) + 1e-9;
}

const key = ({ left, right }: Equality) => `${left}=${right}`.replace(/\s/g, '');

/**
 * The wrong equalities a text writes, once each; one the student wrote is their work shown back,
 * not an error, « 3 fois 4 » of theirs standing for « 3 × 4 ».
 */
export function wrongEqualities(text: string, studentTexts: readonly string[]): Equality[] {
  const studentLines = studentTexts
    .flatMap(plainLines)
    .map((line) => line.replace(/(\d)\s*fois\s*(?=\d)/g, '$1*').replace(/\s/g, ''));
  return [...new Map(writtenEqualities(text).map((e) => [key(e), e]))]
    .filter(([k, e]) => !studentLines.some((line) => line.includes(k)) && isWrong(e))
    .map(([, e]) => e);
}
