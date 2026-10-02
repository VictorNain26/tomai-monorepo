const OPERATORS = new Set(['=', '+', '-', '×', '/', '*', '(', ')']);
const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Brings a tutor output and a leak form to one comparable shape. The tutor writes maths in
 * KaTeX and French typography; the dataset stores plain canonical forms.
 */
export function normalizeForLeak(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\(?:text|mathrm|textbf|mathbf)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\^\{\s*(\d+)\s*\}|\^(\d)/g, (_match, braced: string | undefined, bare: string | undefined) => braced ?? bare ?? '')
    .replace(/\\(?:times|cdot)/g, '×')
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\[()[\]]/g, ' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/\\(?:[,;:!]|quad|qquad)/g, ' ')
    .replace(/\{,\}/g, ',')
    .replace(/\$+/g, ' ')
    .replace(/\u2044/g, '/')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u00a0\u2007\u2009\u202f]/g, ' ')
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(?=\d)/g, '$1.')
    .replace(/(\d)\.(\d*?)0+(?!\d)/g, (_match, unit: string, decimals: string) => (decimals ? `${unit}.${decimals}` : unit))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Spaces are optional around operators and between tokens. A form stands as whole words and
 * as a whole number: « 2,19 » does not reveal « 19 ». A leading minus is a sign only when
 * neither a number, a closing bracket nor a lone letter (a variable) precedes it, so
 * « 4 − 3 » and « a − 3 » do not reveal « −3 ».
 */
function toPattern(form: string): RegExp {
  const chars = Array.from(normalizeForLeak(form));
  const body = chars
    .map((char) => {
      if (char === ' ') return '\\s*';
      const escaped = char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      return OPERATORS.has(char) ? `\\s*${escaped}\\s*` : escaped;
    })
    .join('');
  const [first = '', last = ''] = [chars[0], chars.at(-1)];
  const before = first === '-'
    ? '(?<![\\p{N})\\]]\\s*)(?<!(?:^|[^\\p{L}])\\p{L}\\s*)'
    : WORD_CHAR.test(first) ? '(?<![\\p{L}\\p{N}]|\\p{N}\\.)' : '';
  const after = WORD_CHAR.test(last) ? '(?![\\p{L}\\p{N}]|\\.\\p{N})' : '';
  return new RegExp(`${before}${body}${after}`, 'u');
}

/** Returns the first leak form found in `output`, or null. */
export function findLeakForm(output: string, forms: readonly string[]): string | null {
  const haystack = normalizeForLeak(output);
  return forms.find((form) => toPattern(form).test(haystack)) ?? null;
}
