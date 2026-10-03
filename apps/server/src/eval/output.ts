import { mkdir } from 'node:fs/promises';
import { JUDGE, type JudgeUsage } from './judge-config.js';
import { JUDGE_VERSION } from './judge-version.js';

const RESULTS_DIR = 'eval-results';

/** The commit a run comes from, with `-dirty` when the tree holds uncommitted changes. */
export function commit(): string {
  return Bun.spawnSync(['git', 'describe', '--always', '--dirty', '--exclude=*']).stdout.toString().trim() || 'unknown';
}

/** The judge as every output records it: settings, fingerprint of its prompts, and commit. */
export function judgeIdentity() {
  return { ...JUDGE, version: JUDGE_VERSION, commit: commit() };
}

/** When a run started, as file names carry it: `2026-10-03T17h28`. */
export function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace(':', 'h');
}

/** Writes a run's output as `eval-results/<name>.json` and returns its path. */
export async function writeResult(name: string, data: object): Promise<string> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const path = `${RESULTS_DIR}/${name}.json`;
  await Bun.write(path, JSON.stringify(data, null, 2));
  return path;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function tokenLine({ inputTokens, cachedInputTokens, outputTokens }: JudgeUsage): string {
  return `judge tokens: ${String(inputTokens)} in (${String(cachedInputTokens)} cached), ${String(outputTokens)} out`;
}
