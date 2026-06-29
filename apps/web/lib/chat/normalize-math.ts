/**
 * Le modèle (Mistral) émet les maths en délimiteurs LaTeX `\(…\)` / `\[…\]`,
 * alors que remark-math n'interprète que `$…$` / `$$…$$`. On convertit les
 * délimiteurs, en laissant intacts les blocs de code (``` fences ```) et le
 * code inline (`…`) où un `\(` peut être du code légitime.
 */
export function normalizeMathDelimiters(input: string): string {
  return input
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 0 ? convert(part) : part))
    .join("");
}

function convert(text: string): string {
  return text
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$");
}
