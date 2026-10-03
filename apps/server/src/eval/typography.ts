/**
 * The KaTeX and French typography every maths check reads past: text commands, products,
 * brackets, Markdown emphasis, thin spaces, dashes, digit groups and the decimal comma.
 * Fractions and exponents are left to each check, which reads them differently.
 */
export function plainTypography(text: string): string {
  return text
    .replace(/\\(?:text|mathrm|textbf|mathbf)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:times|cdot)/g, '×')
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\[()[\]]/g, ' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/\\(?:[,;:!]|quad|qquad)/g, ' ')
    .replace(/\{,\}/g, ',')
    .replace(/\$+/g, ' ')
    .replace(/⁄/g, '/')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[\u00a0\u2007\u2009\u202f]/g, ' ')
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(?=\d)/g, '$1.');
}
