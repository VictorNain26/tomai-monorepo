/**
 * Every string leaf of a JSON value, one per line. Serialising with JSON.stringify would turn
 * a newline into the letters `\n`, glued to the next word.
 */
export function collectStrings(value: unknown, numbers = true): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return numbers ? String(value) : '';
  if (Array.isArray(value))
    return value
      .map((item) => collectStrings(item, numbers))
      .filter(Boolean)
      .join('\n');
  if (value !== null && typeof value === 'object') {
    return Object.values(value)
      .map((item) => collectStrings(item, numbers))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}
