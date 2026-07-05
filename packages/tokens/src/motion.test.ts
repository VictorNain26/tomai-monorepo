import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { motionDurations } from "./motion";

function parseDurationVars(css: string): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const [, name, value] of css.matchAll(/--duration-([\w-]+):\s*(\d+)ms;/g)) {
    vars[name as string] = Number(value);
  }
  return vars;
}

const packageRoot = join(import.meta.dir, "..");

describe("cohérence CSS ↔ TS des tokens motion", () => {
  test("theme.css déclare les mêmes durées que motionDurations", () => {
    const cssVars = parseDurationVars(readFileSync(join(packageRoot, "theme.css"), "utf8"));
    expect(cssVars).toEqual({ ...motionDurations });
  });
});
