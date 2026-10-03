import { describe, it, expect } from 'bun:test';
import { rm } from 'node:fs/promises';
import { commit, errorMessage, stamp, tokenLine, writeResult } from '../eval/output';

describe('output', () => {
  it('stamps a run to the minute, as file names carry it', () => {
    expect(stamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}h\d{2}$/);
  });

  it('names the commit, marked dirty when the tree holds changes', () => {
    expect(commit()).toMatch(/^(?:[0-9a-f]{7,}(?:-dirty)?|unknown)$/);
  });

  it('writes a result under eval-results and gives its path back', async () => {
    const name = `test-output-${crypto.randomUUID()}`;
    const path = await writeResult(name, { judge: 'j', lines: [1] });
    try {
      expect(path).toBe(`eval-results/${name}.json`);
      expect(await Bun.file(path).json()).toEqual({ judge: 'j', lines: [1] });
    } finally {
      await rm(path);
    }
  });

  it('reads an error message and prints the judge tokens', () => {
    expect(errorMessage(new Error('Rate limit exceeded'))).toBe('Rate limit exceeded');
    expect(errorMessage('timeout')).toBe('timeout');
    expect(tokenLine({ inputTokens: 10, cachedInputTokens: 8, outputTokens: 2 })).toBe('judge tokens: 10 in (8 cached), 2 out');
  });
});
