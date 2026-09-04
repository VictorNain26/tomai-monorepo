import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const hook = join(repoRoot, '.claude/hooks/block-destructive-db.sh');

function decisionFor(command) {
  const result = spawnSync(hook, {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `le hook doit toujours sortir en 0, pas ${result.status}`);
  return result.stdout.includes('"permissionDecision"') && result.stdout.includes('"deny"')
    ? 'deny'
    : 'allow';
}

const blocked = [
  ['db:push avec une config prod', 'bun run db:push --config drizzle.config.prod.ts'],
  ['db:push avec une DATABASE_URL distante', 'DATABASE_URL=postgres://u@db.koyeb.app/x bun run db:push'],
  ['drizzle-kit push visant staging', 'drizzle-kit push --config=drizzle.config.staging.ts'],
  ['dropdb', 'dropdb tomai_dev'],
  ['drop database via psql', 'psql -U tomai_dev -c "DROP DATABASE tomai_dev"'],
];

for (const [label, command] of blocked) {
  test(`bloque : ${label}`, () => {
    assert.equal(decisionFor(command), 'deny');
  });
}

const allowed = [
  ['commande sans rapport', 'git log --oneline -5'],
  ['db:push sur la base locale', 'bun run db:push'],
  ['grep qui mentionne la phrase', 'grep -rn "drop database" docs/'],
  ['message de commit qui mentionne la phrase', 'git commit -m "docs: pourquoi db:push est interdit en prod"'],
];

for (const [label, command] of allowed) {
  test(`laisse passer : ${label}`, () => {
    assert.equal(decisionFor(command), 'allow');
  });
}

// Non-régression : le client et le `drop` étaient cherchés séparément dans la
// commande entière, si bien qu'une commande composée où les deux apparaissent
// sans jamais se rencontrer se faisait refuser.
test('laisse passer : grep du motif ET db:push local dans la même commande composée', () => {
  assert.equal(decisionFor('grep -rn "drop database" docs/ && bun run db:push'), 'allow');
});
