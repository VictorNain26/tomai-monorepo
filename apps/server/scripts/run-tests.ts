/**
 * Runs each test file in its own Bun process, several at once.
 *
 * `mock.module` replaces a module for the whole process, so test files need isolating. `bun test
 * --isolate` does it in one process, a fresh global per file, and Bun 1.4.2 crashes there at
 * random once files have retired their global (oven-sh/bun#44161, open: SIGSEGV in
 * JSFinalizationRegistry::takeDeadHoldingsValue; `--parallel` implies `--isolate`). A process per
 * file never retires a global. Back to `bun test --isolate` once a Bun release fixes it.
 *
 * Usage: bun run scripts/run-tests.ts [dir] [--coverage] [--jobs=N]
 * `--jobs=1` for files that share a database or an external API; the CPU count by default.
 */

import { availableParallelism } from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { Glob } from 'bun';
import { mergeCoverageReportFiles } from 'lcov-result-merger';

const args = process.argv.slice(2);
const dir = args.find((arg) => !arg.startsWith('--')) ?? 'src/tests';
const coverage = args.includes('--coverage');
const jobs = Number(args.find((arg) => arg.startsWith('--jobs='))?.slice('--jobs='.length) ?? availableParallelism());
const coverageDir = 'coverage';

interface FileRun {
  file: string;
  code: number;
  output: string;
  ms: number;
}

const count = (output: string, word: 'pass' | 'fail') =>
  [...output.matchAll(new RegExp(`^\\s*(\\d+) ${word}$`, 'gm'))].reduce((sum, match) => sum + Number(match[1]), 0);

async function runFile(file: string, index: number): Promise<FileRun> {
  const start = performance.now();
  const flags = coverage ? ['--coverage', '--coverage-reporter=lcov', `--coverage-dir=${coverageDir}/files/${index}`] : [];
  const child = Bun.spawn(['bun', 'test', `./${file}`, ...flags], { stdout: 'pipe', stderr: 'pipe', env: process.env });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { file, code, output: `${stdout}${stderr}`, ms: performance.now() - start };
}

const files = [...new Glob(`${dir}/**/*.test.ts`).scanSync('.')].sort();
if (files.length === 0) {
  console.error(`No test file in ${dir}`);
  process.exit(1);
}
if (coverage) await rm(coverageDir, { recursive: true, force: true });

const runs: FileRun[] = [];
let next = 0;
async function worker(): Promise<void> {
  for (let index = next++; index < files.length; index = next++) {
    const run = await runFile(files[index] ?? '', index);
    runs.push(run);
    // A failing file prints all it wrote; a passing one, a line.
    if (run.code === 0) console.log(`✓ ${run.file} (${Math.round(run.ms)} ms)`);
    else console.log(`✗ ${run.file} (exit ${run.code})\n${run.output}`);
  }
}
await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, files.length)) }, worker));

if (coverage) {
  const reports = [...new Glob(`${coverageDir}/files/*/lcov.info`).scanSync('.')];
  const merged = await mergeCoverageReportFiles(reports, { pattern: `${coverageDir}/files/*/lcov.info` });
  await mkdir(coverageDir, { recursive: true });
  await writeFile(`${coverageDir}/lcov.info`, merged);
  const found = [...merged.matchAll(/^LF:(\d+)$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  const hit = [...merged.matchAll(/^LH:(\d+)$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  console.log(`Lines covered: ${hit}/${found} (${found ? ((100 * hit) / found).toFixed(1) : '0'} %), ${coverageDir}/lcov.info`);
}

const failed = runs.filter((run) => run.code !== 0);
console.log(`\n ${runs.reduce((sum, run) => sum + count(run.output, 'pass'), 0)} pass`);
console.log(` ${runs.reduce((sum, run) => sum + count(run.output, 'fail'), 0)} fail`);
console.log(`Ran ${files.length} files, ${failed.length} failed.`);
if (failed.length > 0) {
  console.log(failed.map((run) => `  ${run.file} (exit ${run.code})`).join('\n'));
  process.exit(1);
}
