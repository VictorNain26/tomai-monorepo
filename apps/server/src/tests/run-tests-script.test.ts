import { describe, it, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs, totalsOf } from '../../scripts/run-tests';

const exists = (path: string) => ['src/tests', 'src/integration-tests', 'src/tests/foo.test.ts'].includes(path);

describe('parseArgs', () => {
  it('runs src/tests on half the cores by default', () => {
    expect(parseArgs([], exists, 8)).toEqual({ target: 'src/tests', coverage: false, jobs: 4, bunArgs: [] });
    expect(parseArgs([], exists, 1).jobs).toBe(1);
  });

  it('reads the target, coverage and jobs, and hands every other option to bun test', () => {
    expect(parseArgs(['src/integration-tests', '--jobs=1', '--coverage', '-t', 'embeddings', '--timeout', '20000'], exists, 8)).toEqual({
      target: 'src/integration-tests',
      coverage: true,
      jobs: 1,
      bunArgs: ['-t', 'embeddings', '--timeout', '20000'],
    });
    expect(parseArgs(['src/tests/foo.test.ts'], exists, 8).target).toBe('src/tests/foo.test.ts');
  });

  it('refuses a number of jobs that would run nothing', () => {
    for (const jobs of ['one', '0', '1.5', '']) {
      expect(() => parseArgs([`--jobs=${jobs}`], exists, 8)).toThrow('--jobs takes a whole number from 1');
    }
  });
});

describe('totalsOf', () => {
  it('reads the counts bun test prints, a missing one as 0', () => {
    expect(totalsOf(' 12 pass\n 1 skip\n 0 fail\n 41 expect() calls\nRan 13 tests across 1 file.')).toEqual({ pass: 12, fail: 0, skip: 1, todo: 0 });
    expect(totalsOf('error: crashed')).toEqual({ pass: 0, fail: 0, skip: 0, todo: 0 });
  });
});

describe('run-tests.ts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-tests-'));
  const script = resolve(import.meta.dir, '../../scripts/run-tests.ts');
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

  const run = (...args: string[]) => {
    const child = Bun.spawnSync(['bun', 'run', script, ...args], { cwd: dir, env: { ...process.env, NO_COLOR: '1' } });
    return { code: child.exitCode, out: child.stdout.toString() };
  };

  it('runs each file in its own process, sums their counts, and fails when one file fails', () => {
    writeFileSync(join(dir, 'a.test.ts'), "import { test, expect } from 'bun:test';\ntest('a', () => { expect(globalThis.shared).toBeUndefined(); globalThis.shared = 1; });\n");
    writeFileSync(join(dir, 'b.spec.ts'), "import { test, expect } from 'bun:test';\ntest('b', () => { expect(globalThis.shared).toBeUndefined(); globalThis.shared = 1; });\n");
    const passing = run('.', '--jobs=1');
    expect(passing.code).toBe(0);
    expect(passing.out).toContain(' 2 pass\n 0 fail\nRan 2 files, 0 failed.');

    writeFileSync(join(dir, 'c_test.ts'), "import { test, expect } from 'bun:test';\ntest('c', () => { expect(1).toBe(2); });\n");
    const failing = run('.', '--jobs=2');
    expect(failing.code).toBe(1);
    expect(failing.out).toContain('✗ c_test.ts (exit 1)');
    expect(failing.out).toContain('Ran 3 files, 1 failed.');
  });
});
