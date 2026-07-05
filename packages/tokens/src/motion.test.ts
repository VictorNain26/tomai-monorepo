import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { motionDurations, motionEasings } from "./motion";

describe("motion tokens", () => {
  test("motionDurations exposes fast, base, slow, pulse in ms", () => {
    expect(motionDurations).toEqual({
      fast: 150,
      base: 250,
      slow: 400,
      pulse: 1000,
    });
  });

  test("motionEasings exposes cubic-bezier tuples (Reanimated-compatible)", () => {
    expect(motionEasings).toEqual({
      out: [0, 0, 0.2, 1],
      inOut: [0.4, 0, 0.2, 1],
    });
  });

  test("theme.css contains duration tokens as CSS custom properties", () => {
    const themePath = resolve(__dirname, "../theme.css");
    const content = readFileSync(themePath, "utf-8");
    expect(content).toContain("--duration-fast: 150ms;");
    expect(content).toContain("--duration-base: 250ms;");
    expect(content).toContain("--duration-slow: 400ms;");
    expect(content).toContain("--duration-pulse: 1000ms;");
  });
});
