// apps/mobile/scripts/codemod-semantic-colors.mjs
// Codemod one-shot phase 4b : classes palette brutes -> classes sémantiques @repo/tokens.
// Dry-run par défaut (rapport seul) ; `--write` applique.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Paires adjacentes `light dark:` -> classe sémantique. Ordre: motifs les plus longs d'abord.
const PAIR_MAP = [
  ['bg-stone-50 dark:bg-stone-900', 'bg-background'],
  ['bg-slate-50 dark:bg-slate-900', 'bg-background'],
  ['bg-white dark:bg-stone-800', 'bg-card'],
  ['bg-white dark:bg-stone-900', 'bg-background'],
  ['bg-stone-100 dark:bg-stone-800', 'bg-muted'],
  ['bg-stone-200 dark:bg-stone-700', 'bg-muted'],
  ['border-stone-200 dark:border-stone-700', 'border-border'],
  ['border-stone-100 dark:border-stone-700', 'border-border'],
  ['border-stone-300 dark:border-stone-600', 'border-border'],
  ['border-slate-200 dark:border-slate-700', 'border-border'],
  ['text-white dark:text-stone-900', 'text-primary-foreground'],
  ['text-stone-900 dark:text-white', 'text-foreground'],
  ['text-stone-900 dark:text-stone-50', 'text-foreground'],
  ['text-stone-900 dark:text-stone-100', 'text-foreground'],
  ['text-stone-800 dark:text-stone-100', 'text-foreground'],
  ['text-stone-600 dark:text-stone-400', 'text-muted-foreground'],
  ['text-stone-500 dark:text-stone-400', 'text-muted-foreground'],
  ['text-slate-600 dark:text-slate-400', 'text-muted-foreground'],
  ['text-blue-600 dark:text-blue-400', 'text-primary'],
  ['bg-blue-600 dark:bg-blue-400', 'bg-primary'],
  ['border-blue-600 dark:border-blue-400', 'border-primary'],
  ['text-red-600 dark:text-red-400', 'text-destructive'],
  ['text-red-500 dark:text-red-400', 'text-destructive'],
  ['bg-red-600 dark:bg-red-400', 'bg-destructive'],
  ['border-red-600 dark:border-red-400', 'border-destructive'],
  ['text-emerald-600 dark:text-emerald-400', 'text-success'],
  ['text-amber-600 dark:text-amber-400', 'text-warning'],
  ['bg-amber-600 dark:bg-amber-400', 'bg-warning'],
  ['text-yellow-600 dark:text-yellow-400', 'text-warning'],
  ['text-purple-600 dark:text-purple-400', 'text-violet'],
  // Surfaces pastel (badges/encarts) -> token + opacité (color-mix, supporté NativeWind v5)
  ['bg-blue-50 dark:bg-blue-950', 'bg-primary/10'],
  ['bg-emerald-50 dark:bg-emerald-950', 'bg-success/10'],
  ['bg-amber-50 dark:bg-amber-950', 'bg-warning/10'],
  ['bg-yellow-50 dark:bg-yellow-950', 'bg-warning/10'],
  ['bg-red-50 dark:bg-red-950', 'bg-destructive/10'],
  ['bg-purple-50 dark:bg-purple-950', 'bg-violet/10'],
  ['border-blue-200 dark:border-blue-800', 'border-primary/30'],
  ['border-emerald-200 dark:border-emerald-800', 'border-success/30'],
  ['border-amber-200 dark:border-amber-800', 'border-warning/30'],
  ['border-yellow-200 dark:border-yellow-800', 'border-warning/30'],
  ['border-purple-200 dark:border-purple-800', 'border-violet/30'],
];

// Classes isolées non ambiguës (appliquées APRÈS les paires).
const LONE_MAP = [
  ['text-stone-900', 'text-foreground'],
  ['text-stone-800', 'text-foreground'],
  ['text-stone-600', 'text-muted-foreground'],
  ['text-stone-500', 'text-muted-foreground'],
  ['text-blue-600', 'text-primary'],
  ['text-red-600', 'text-destructive'],
  // text-red-500 sans dark: variant = texte d'erreur inline (error message, validation)
  ['text-red-500', 'text-destructive'],
  ['text-emerald-600', 'text-success'],
  ['text-amber-600', 'text-warning'],
];

const SKIP = ['src/constants/subjects.ts'];
const PALETTE_RE =
  /\b(?:[a-z-]+:)*(?:bg|text|border|divide|ring|fill|stroke|placeholder)-(?:stone|gray|slate|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+(?:\/[0-9]+)?\b/g;

const write = process.argv.includes('--write');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) files.push(p);
  }
})('src');

const counts = new Map();
const remaining = [];
for (const file of files) {
  if (SKIP.includes(file)) continue;
  let content = readFileSync(file, 'utf8');
  const before = content;
  for (const [from, to] of [...PAIR_MAP, ...LONE_MAP]) {
    const re = new RegExp('(?<![\\w:-])' + from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![\\w/-])', 'g');
    content = content.replace(re, () => {
      counts.set(from, (counts.get(from) ?? 0) + 1);
      return to;
    });
  }
  if (write && content !== before) writeFileSync(file, content);
  for (const [i, line] of content.split('\n').entries()) {
    for (const m of line.matchAll(PALETTE_RE)) remaining.push(`${file}:${i + 1} ${m[0]}`);
  }
}

console.log(write ? '== APPLIQUÉ ==' : '== DRY-RUN ==');
for (const [from, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${from}`);
console.log(`\nTotal remplacé: ${[...counts.values()].reduce((a, b) => a + b, 0)}`);
console.log(`\nRestant à traiter manuellement (${remaining.length}):`);
for (const r of remaining) console.log('  ' + r);
