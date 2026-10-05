/**
 * Runs each test file in its own Bun process, several at once.
 *
 * `mock.module` replaces a module for the whole process, so test files need isolating. `bun test
 * --isolate` does it in one process, a fresh global per file, and Bun 1.4.2 crashes there at
 * random once files have retired their global (oven-sh/bun#44161, open: SIGSEGV in
 * JSFinalizationRegistry::takeDeadHoldingsValue; `--parallel` implies `--isolate`). A process per
 * file never retires a global. Back to `bun test --isolate` once a Bun release fixes it.
 *
 * Usage: bun run scripts/run-tests.ts [dir | file] [--coverage] [--jobs=N] [bun test options…]
 * `--jobs=1` for files that share a database or an external API. Any other option goes to each
 * `bun test`, as `-t <pattern>` or `--timeout <ms>`.
 */

import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { normalize } from 'node:path';
import { rm, writeFile } from 'node:fs/promises';
import { Glob } from 'bun';
import { mergeCoverageReportFiles } from 'lcov-result-merger';

// The names `bun test` discovers (https://bun.com/docs/test/discovery).
export const TEST_FILES = '**/*{.test,_test,.spec,_spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}';
const COVERAGE_DIR = 'coverage';
const COVERAGE_REPORTS = `${COVERAGE_DIR}/files/*/lcov.info`;

export interface RunOptions {
  target: string;
  coverage: boolean;
  jobs: number;
  bunArgs: string[];
}

/**
 * The target is the first argument naming an existing path; the runner's own options are read;
 * everything else goes to `bun test`. Half the cores by default: turbo runs other workspaces'
 * tests at the same time.
 */
export function parseArgs(args: readonly string[], exists: (path: string) => boolean, cores: number): RunOptions {
  const target = args.find((arg) => !arg.startsWith('-') && exists(arg)) ?? 'src/tests';
  const jobsArg = args.find((arg) => arg.startsWith('--jobs='));
  const jobs = jobsArg ? Number(jobsArg.slice('--jobs='.length)) : Math.max(1, Math.floor(cores / 2));
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs takes a whole number from 1, not « ${jobsArg?.slice('--jobs='.length) ?? ''} »`);
  return {
    target,
    coverage: args.includes('--coverage'),
    jobs,
    bunArgs: args.filter((arg) => arg !== target && arg !== '--coverage' && arg !== jobsArg),
  };
}

export interface Totals {
  pass: number;
  fail: number;
  skip: number;
  todo: number;
}

/** The counts `bun test` prints at the end of a file's run, read without colours. */
export function totalsOf(output: string): Totals {
  const count = (word: keyof Totals) => [...output.matchAll(new RegExp(`^\\s*(\\d+) ${word}$`, 'gm'))].reduce((sum, match) => sum + Number(match[1]), 0);
  return { pass: count('pass'), fail: count('fail'), skip: count('skip'), todo: count('todo') };
}

interface FileRun {
  file: string;
  code: number;
  output: string;
  ms: number;
}

async function runFile(file: string, index: number, options: RunOptions): Promise<FileRun> {
  const start = performance.now();
  const coverage = options.coverage ? ['--coverage', '--coverage-reporter=lcov', `--coverage-dir=${COVERAGE_DIR}/files/${index}`] : [];
  const child = Bun.spawn(['bun', 'test', `./${file}`, ...coverage, ...options.bunArgs], {
    stdout: 'pipe',
    stderr: 'pipe',
    // Plain output, which totalsOf reads.
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { file, code, output: `${stdout}${stderr}`, ms: performance.now() - start };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2), existsSync, availableParallelism());
  const files = /[._](?:test|spec)\.[cm]?[jt]sx?$/.test(options.target)
    ? [options.target]
    : [...new Glob(`${options.target}/${TEST_FILES}`).scanSync('.')].map((file) => normalize(file)).sort();
  if (files.length === 0) throw new Error(`No test file in ${options.target}`);
  if (options.coverage) await rm(COVERAGE_DIR, { recursive: true, force: true });

  const runs: FileRun[] = [];
  const queue = files.entries();
  const worker = async () => {
    for (const [index, file] of queue) {
      const run = await runFile(file, index, options);
      runs.push(run);
      if (run.code === 0) console.log(`✓ ${run.file} (${Math.round(run.ms)} ms)`);
      else console.log(`✗ ${run.file} (exit ${run.code})\n${run.output}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.jobs, files.length) }, worker));

  if (options.coverage) {
    const reports = [...new Glob(COVERAGE_REPORTS).scanSync('.')];
    const merged = await mergeCoverageReportFiles(reports, { pattern: COVERAGE_REPORTS });
    await writeFile(`${COVERAGE_DIR}/lcov.info`, merged);
    const sum = (key: string) => [...merged.matchAll(new RegExp(`^${key}:(\\d+)$`, 'gm'))].reduce((total, match) => total + Number(match[1]), 0);
    const found = sum('LF');
    const hit = sum('LH');
    console.log(`Lines covered: ${hit}/${found} (${found ? ((100 * hit) / found).toFixed(1) : '0'} %), ${COVERAGE_DIR}/lcov.info`);
  }

  const totals = runs.map((run) => totalsOf(run.output)).reduce((a, b) => ({ pass: a.pass + b.pass, fail: a.fail + b.fail, skip: a.skip + b.skip, todo: a.todo + b.todo }));
  const failed = runs.filter((run) => run.code !== 0);
  console.log(`\n ${totals.pass} pass`);
  if (totals.skip > 0) console.log(` ${totals.skip} skip`);
  if (totals.todo > 0) console.log(` ${totals.todo} todo`);
  console.log(` ${totals.fail} fail`);
  console.log(`Ran ${files.length} files, ${failed.length} failed.`);
  if (failed.length > 0) {
    console.log(failed.map((run) => `  ${run.file} (exit ${run.code})`).join('\n'));
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
