import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeDate } from "./format-relative-date";

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'à l'instant' under a minute", () => {
    expect(formatRelativeDate("2026-06-30T11:59:30Z")).toBe("à l'instant");
  });
  it("returns minutes under an hour", () => {
    expect(formatRelativeDate("2026-06-30T11:30:00Z")).toBe("il y a 30 min");
  });
  it("returns hours under a day", () => {
    expect(formatRelativeDate("2026-06-30T09:00:00Z")).toBe("il y a 3 h");
  });
  it("returns days under a week", () => {
    expect(formatRelativeDate("2026-06-28T12:00:00Z")).toBe("il y a 2 j");
  });
  it("returns an absolute short date beyond a week", () => {
    expect(formatRelativeDate("2026-06-01T12:00:00Z")).toMatch(/1.*juin/);
  });
});
