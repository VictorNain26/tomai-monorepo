/**
 * Cross-platform test runner that executes each test file in a separate Bun process.
 * Needed because mock.module() pollutes between files when run in a single process.
 * Replaces the bash-only `for f in ...; do bun test "$f"; done` loop.
 *
 * Usage:
 *   bun run scripts/run-tests.ts                  # defaults to src/tests
 *   bun run scripts/run-tests.ts src/integration-tests
 *   bun run scripts/run-tests.ts src/tests --coverage
 */
import { Glob } from "bun";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const args = process.argv.slice(2);
const withCoverage = args.includes("--coverage");

// First positional argument (non-flag) is the target directory; defaults to src/tests.
const targetDirArg = args.find((a) => !a.startsWith("--"));

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDir, "..");
const testDir = resolve(serverRoot, targetDirArg ?? "src/tests");

const glob = new Glob("*.test.ts");
const testFiles = [...glob.scanSync(testDir)].sort();

const relativeDir = targetDirArg ?? "src/tests";

if (testFiles.length === 0) {
  console.error(`No test files found in ${relativeDir}/`);
  process.exit(1);
}

let failed = 0;
let passed = 0;

for (const file of testFiles) {
  const filePath = `${relativeDir}/${file}`;
  const cmd = ["bun", "test", filePath];
  if (withCoverage) cmd.push("--coverage");

  const proc = Bun.spawn(cmd, {
    stdout: "inherit",
    stderr: "inherit",
    cwd: serverRoot,
  });
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    failed++;
  } else {
    passed++;
  }
}

console.log(
  `\n${passed + failed} files: ${passed} passed, ${failed} failed`
);
process.exit(failed > 0 ? 1 : 0);
