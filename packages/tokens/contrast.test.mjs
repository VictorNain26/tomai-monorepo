import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const colors = (css) =>
  Object.fromEntries(
    [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(([, name, hex]) => [name, hex]),
  );

const palette = colors(read("./theme.css"));

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
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "secondary"],
  ["foreground", "highlight"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "secondary"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary", "secondary"],
  ["primary-foreground", "primary"],
  ["success-foreground", "success"],
  ["destructive-foreground", "destructive"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["success", "background"],
  ["success", "card"],
  ["destructive", "background"],
  ["info", "background"],
  ["annotation", "background"],
  ["annotation", "card"],
  ["annotation", "secondary"],
];

for (const [fg, bg] of PAIRS) {
  test(`${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
    assert.ok(palette[fg], `missing --color-${fg}`);
    assert.ok(palette[bg], `missing --color-${bg}`);
    const ratio = contrast(palette[fg], palette[bg]);
    assert.ok(ratio >= 4.5, `${palette[fg]} on ${palette[bg]} = ${ratio.toFixed(2)}`);
  });
}

const CONTROL_PAIRS = [
  ["input", "background"],
  ["input", "card"],
];

for (const [fg, bg] of CONTROL_PAIRS) {
  test(`${fg} on ${bg} meets WCAG 1.4.11 (3:1)`, () => {
    assert.ok(palette[fg], `missing --color-${fg}`);
    assert.ok(palette[bg], `missing --color-${bg}`);
    const ratio = contrast(palette[fg], palette[bg]);
    assert.ok(ratio >= 3, `${palette[fg]} on ${palette[bg]} = ${ratio.toFixed(2)}`);
  });
}
