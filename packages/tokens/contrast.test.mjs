import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const colors = (css) => Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(([, name, hex]) => [name, hex]));

// The dark block wherever it sits in the file; every other color is light. The landing keeps its
// own palette until lot 4.
const theme = read('./theme.css');
const darkBlock = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\n\}/.exec(theme);
const light = colors(theme.replace(darkBlock?.[0] ?? '', ''));
const dark = colors(darkBlock?.[1] ?? '');
const modes = Object.entries({ light, dark, landing: colors(read('./landing.css')) });

test('the dark mode gives every light color its own value', () => {
  assert.ok(darkBlock, 'no @media (prefers-color-scheme: dark) block in theme.css');
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
});

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'secondary'],
  ['foreground', 'highlight'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'secondary'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['primary', 'secondary'],
  ['primary-foreground', 'primary'],
  ['success-foreground', 'success'],
  ['destructive-foreground', 'destructive'],
  ['warning-foreground', 'warning'],
  ['success', 'background'],
  ['success', 'card'],
  ['destructive', 'background'],
  ['annotation', 'background'],
  ['annotation', 'card'],
  ['annotation', 'secondary'],
];

// Tokens the app added after the landing froze: checked in each palette that defines them, which
// the app's light one must (landing.css takes none until lot 4).
const APP_PAIRS = [['qr', 'qr-background']];

test('the app’s palette defines the tokens it added after the landing froze', () => {
  for (const [fg, bg] of APP_PAIRS) assert.ok(light[fg] && light[bg], `missing --color-${fg} or --color-${bg}`);
});

const CONTROL_PAIRS = [
  ['input', 'background'],
  ['input', 'card'],
  ['input', 'secondary'],
  ['ring', 'background'],
  ['ring', 'card'],
];

for (const [mode, palette] of modes) {
  for (const [pairs, minimum, criterion] of [
    [[...PAIRS, ...APP_PAIRS.filter(([fg, bg]) => palette[fg] && palette[bg])], 4.5, 'WCAG AA (4.5:1)'],
    [CONTROL_PAIRS, 3, 'WCAG 1.4.11 (3:1)'],
  ]) {
    for (const [fg, bg] of pairs) {
      test(`${mode}: ${fg} on ${bg} meets ${criterion}`, () => {
        assert.ok(palette[fg], `missing --color-${fg}`);
        assert.ok(palette[bg], `missing --color-${bg}`);
        const ratio = contrast(palette[fg], palette[bg]);
        assert.ok(ratio >= minimum, `${palette[fg]} on ${palette[bg]} = ${ratio.toFixed(2)}`);
      });
    }
  }
}
