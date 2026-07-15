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

const CODE_SPAN_SPLIT = /(```[\s\S]*?```|`[^`\n]*`)/g;

/**
 * Le backend (Mistral) émet les maths en `\(…\)` / `\[…\]`, alors que la
 * détection ne lit que `$…$` / `$$…$$`. On convertit les délimiteurs en
 * laissant intacts les blocs de code (``` fences ```) et le code inline (`…`),
 * pour ne pas transformer un `\(` littéral dans du code.
 */
export function normalizeMathDelimiters(input: string): string {
  return input
    .split(CODE_SPAN_SPLIT)
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
 * Parse text into segments of plain text and math.
 *
 * Les deux familles de délimiteurs (`$…$`/`$$…$$` et `\(…\)`/`\[…\]`) sont
 * matchées directement sur le texte brut : convertir d'abord `\(…\)` en `$…$`
 * rendrait la paire ambiguë face à un `$` littéral déjà présent (« 5$ »).
 * Les spans de code (fences et inline) sont exclus du parsing math.
 */
export function parseContent(rawText: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const mathRegex = /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^$\n]+?\$)|(\\\([^\n]+?\\\))/g;

  const pushText = (content: string) => {
    if (!content) return;
    const last = segments[segments.length - 1];
    if (last?.type === 'text') {
      last.content += content;
      return;
    }
    if (!content.trim()) return;
    segments.push({ type: 'text', content });
  };

  for (const [i, part] of rawText.split(CODE_SPAN_SPLIT).entries()) {
    if (i % 2 === 1) {
      pushText(part);
      continue;
    }

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    mathRegex.lastIndex = 0;

    while ((match = mathRegex.exec(part)) !== null) {
      pushText(part.slice(lastIndex, match.index));

      const fullMatch = match[0];
      if (fullMatch.startsWith('$$') || fullMatch.startsWith('\\[')) {
        segments.push({
          type: 'block-math',
          content: fullMatch.slice(2, -2).trim(),
        });
      } else if (fullMatch.startsWith('\\(')) {
        segments.push({
          type: 'inline-math',
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

    pushText(part.slice(lastIndex));
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: rawText });
  }

  return segments;
}
