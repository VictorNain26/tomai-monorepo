/**
 * Pure text-parsing helpers for MathText — no React Native / WebView deps, so
 * they can be unit-tested in isolation. MathText.tsx owns the KaTeX rendering.
 */

export interface ParsedSegment {
  type: 'text' | 'inline-math' | 'block-math';
  content: string;
}

// ============================================================================
// DELIMITER NORMALIZATION
// ============================================================================

/**
 * Le backend (Mistral) émet les maths en `\(…\)` / `\[…\]`, alors que la
 * détection et le parsing ci-dessous ne lisent que `$…$` / `$$…$$`. On convertit
 * les délimiteurs en laissant intacts les blocs de code (``` fences ```) et le
 * code inline (`…`), pour ne pas transformer un `\(` littéral dans du code.
 */
export function normalizeMathDelimiters(input: string): string {
  return input
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 0 ? convertDelimiters(part) : part))
    .join('');
}

function convertDelimiters(text: string): string {
  // Function replacers: a literal '$$' in a string replacement would be read as
  // an escaped single '$'.
  return text
    .replace(/\\\[/g, () => '$$')
    .replace(/\\\]/g, () => '$$')
    .replace(/\\\(/g, () => '$')
    .replace(/\\\)/g, () => '$');
}

// ============================================================================
// MATH DETECTION
// ============================================================================

/**
 * Check if text contains any LaTeX math expressions
 */
export function containsMath(text: string): boolean {
  const normalized = normalizeMathDelimiters(text);
  // Block math: $$...$$
  if (/\$\$[\s\S]+?\$\$/.test(normalized)) return true;
  // Inline math: $...$ (not $$)
  if (/(?<!\$)\$(?!\$).+?(?<!\$)\$(?!\$)/.test(normalized)) return true;
  // LaTeX commands
  if (/\\(frac|sqrt|int|sum|prod|lim|sin|cos|tan|log|ln|exp|alpha|beta|gamma|delta|pi|theta|omega|infty|partial|nabla|vec|hat|bar|dot|ddot)\b/.test(normalized)) return true;
  return false;
}

/**
 * Parse text into segments of plain text and math
 */
export function parseContent(rawText: string): ParsedSegment[] {
  const text = normalizeMathDelimiters(rawText);
  const segments: ParsedSegment[] = [];
  const mathRegex = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push({ type: 'text', content: textBefore });
      }
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
      segments.push({
        type: 'block-math',
        content: fullMatch.slice(2, -2).trim(),
      });
    } else {
      segments.push({
        type: 'inline-math',
        content: fullMatch.slice(1, -1).trim(),
      });
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex);
    if (textAfter.trim()) {
      segments.push({ type: 'text', content: textAfter });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}
