import { isConstantNode, isOperatorNode, isParenthesisNode, parse, type MathNode } from 'mathjs';
import { plainTypography } from './typography';

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
// The colon is the division sign of French schools (« 8 : 4 = 2 »), or a sentence's punctuation.
const NUMERIC = '[\\d. +\\-*/^():]';
const NUMERIC_TAIL = new RegExp(`${NUMERIC}+$`);
const NUMERIC_HEAD = new RegExp(`^${NUMERIC}+`);

/**
 * Each line of a text as plain arithmetic: KaTeX, typography, powers, a leading list number or
 * bullet and money read past. Digit groups are joined only when no word follows: « 5 100 fois » may be a
 * result and a count.
 */
function plainLines(text: string): string[] {
  return text.split('\n').map((line) =>
    plainTypography(
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
      .replace(/×/g, '*'),
  );
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

/** A calculation as mathjs reads it: the colon of a division as a slash. */
const division = (calculation: string) => calculation.replace(/:/g, '/');

/** The calculation that ends a piece of text, or null when it belongs to something else. */
function trailingCalculation(text: string): string | null {
  const match = NUMERIC_TAIL.exec(text);
  if (!match) return null;
  // A sentence's dot or colon is punctuation, not part of the calculation (« Bravo. 2 + 3 »,
  // « Calcul : 2 + 3 »); a decimal one (« .5 ») is.
  const lead = /^(?:[.:](?!\d)|\s)*/.exec(match[0])?.[0] ?? '';
  const before = text.slice(0, match.index + lead.length);
  const calculation = match[0].slice(lead.length).trim();
  if (STANDALONE.test(before)) return /^[+*/^):]/.test(calculation) ? null : division(calculation);
  // « Étape 1 : 2 + 3 »: after a word, the last colon was punctuation, which stands a calculation alone.
  const after = calculation.slice(calculation.lastIndexOf(':') + 1).trim();
  return calculation.includes(':') && after && !/^[+*/^)]/.test(after) ? after : null;
}

/** The calculation that starts a piece of text, or null when a letter is glued to it (« 15x »). */
function leadingCalculation(text: string): string | null {
  const match = NUMERIC_HEAD.exec(text);
  if (!match) return null;
  // « 15x » is a term; « 12 cm » a number and its unit.
  if (!/\s$/.test(match[0]) && /^\p{L}/u.test(text.slice(match[0].length))) return null;
  return division(match[0].trim().replace(/[.:\s]+$/, ''));
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

/** Whether a student line holds the equality whole: « 12+2=56 » does not hold « 2+2=5 ». */
function holds(line: string, equality: string): boolean {
  return new RegExp(`(?<![\\d.])${equality.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![\\d.])`).test(line);
}

/**
 * The wrong equalities a text writes, once each; one the student wrote is their work shown back,
 * not an error, their « 3 fois 4 », « 3 x 4 » and « 8 : 4 » read as products and a division.
 */
export function wrongEqualities(text: string, studentTexts: readonly string[]): Equality[] {
  const studentLines = studentTexts.flatMap(plainLines).map((line) =>
    line
      .replace(/(\d)\s*(?:fois|x|X)\s*(?=\d)/g, '$1*')
      .replace(/(\d)\s*:\s*(?=\d)/g, '$1/')
      .replace(/\s/g, ''),
  );
  return [...new Map(writtenEqualities(text).map((e) => [key(e), e]))]
    .filter(([k, e]) => !studentLines.some((line) => holds(line, k)) && isWrong(e))
    .map(([, e]) => e);
}
