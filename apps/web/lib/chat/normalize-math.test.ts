import { describe, it, expect } from "vitest";
import { normalizeMathDelimiters } from "./normalize-math";

describe("normalizeMathDelimiters", () => {
  it("converts inline \\(...\\) to $...$", () => {
    expect(normalizeMathDelimiters("aire \\( \\pi r^2 \\) ok")).toBe(
      "aire $ \\pi r^2 $ ok",
    );
  });

  it("converts block \\[...\\] to $$...$$", () => {
    expect(normalizeMathDelimiters("\\[ a^2 + b^2 = c^2 \\]")).toBe(
      "$$ a^2 + b^2 = c^2 $$",
    );
  });

  it("leaves existing $...$ and $$...$$ untouched", () => {
    expect(normalizeMathDelimiters("x = $y$ and $$z$$")).toBe("x = $y$ and $$z$$");
  });

  it("does not touch delimiters inside a fenced code block", () => {
    const src = "```js\nconst f = \\(x\\) => x\n```";
    expect(normalizeMathDelimiters(src)).toBe(src);
  });

  it("does not touch delimiters inside inline code", () => {
    expect(normalizeMathDelimiters("use `\\(x\\)` here")).toBe("use `\\(x\\)` here");
  });

  it("normalizes text around a protected code span", () => {
    expect(normalizeMathDelimiters("\\(a\\) `\\(b\\)` \\(c\\)")).toBe(
      "$a$ `\\(b\\)` $c$",
    );
  });
});
