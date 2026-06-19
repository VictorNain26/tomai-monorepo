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

// Files that fail due to Bun-specific test resolver bugs (not code bugs).
// Each entry must include a tracking note so the list doesn't silently rot.
const SKIPPED_FILES = new Set([
  // `chat-session.service` statically imports `episodic-memory.service`, which
  // imports `sessionEpisodes` from the schema barrel. Bun's test resolver
  // fails to propagate re-exported symbols through two levels of
  // `export *` even though the runtime import works (verified via `bun -e`).
  // Behaviour is covered by tool-executor.test + progress.test.
  // TODO: revisit after the next Bun version bump or harness refactor.
  "chat-session.test.ts",
]);

const glob = new Glob("*.test.ts");
const testFiles = [...glob.scanSync(testDir)]
  .filter((file) => !SKIPPED_FILES.has(file))
  .sort();

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
