import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { darkColors, lightColors } from "./colors";

function parseColorVars(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    vars[name as string] = (value as string).trim();
  }
  return vars;
}

const packageRoot = join(import.meta.dir, "..");

describe("cohérence CSS ↔ TS des tokens couleur", () => {
  test("theme.css (light) et lightColors déclarent les mêmes tokens aux mêmes valeurs", () => {
    const cssVars = parseColorVars(readFileSync(join(packageRoot, "theme.css"), "utf8"));
    expect(cssVars).toEqual({ ...lightColors });
  });

  test("theme-dark.css et darkColors déclarent les mêmes tokens aux mêmes valeurs", () => {
    const cssVars = parseColorVars(readFileSync(join(packageRoot, "theme-dark.css"), "utf8"));
    expect(cssVars).toEqual({ ...darkColors });
  });
});
