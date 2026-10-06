/**
 * Integration test — usersRepository.deleteByUsernamePrefix, used by `bun run eval` to
 * remove the accounts of the previous run. Real DB; skips cleanly when it is absent.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

if (!dbReachable) {
  console.warn('[users-delete-prefix.integration] DB unreachable — all tests will be skipped');
}

const tag = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
const usernames = [`itp${tag}_a`, `itp${tag}_b`, `itp${tag}xa`, `other${tag}`];
let repository: Awaited<typeof import('../modules/auth/users.repository')>['usersRepository'];

beforeAll(async () => {
  if (!dbReachable) return;
  repository = (await import('../modules/auth/users.repository')).usersRepository;
  for (const username of usernames) {
    await repository.create({
      id: crypto.randomUUID(),
      name: username,
      email: `${username}@integration.test`,
      username,
      role: 'student',
    });
  }
});

afterAll(async () => {
  if (!dbReachable) return;
  for (const username of usernames) {
    const found = await repository.findByUsername(username);
    if (found) await repository.deleteById(found.id);
  }
});

describe.skipIf(!dbReachable)('usersRepository.deleteByUsernamePrefix', () => {
  it('deletes the matching users only, reading `_` and `%` literally', async () => {
    expect(await repository.deleteByUsernamePrefix(`itp${tag}_`)).toBe(2);
    expect(await repository.findByUsername(`itp${tag}_a`)).toBeUndefined();
    expect(await repository.findByUsername(`itp${tag}xa`)).toBeDefined();
    expect(await repository.findByUsername(`other${tag}`)).toBeDefined();
    expect(await repository.deleteByUsernamePrefix(`itp${tag}%`)).toBe(0);
  });

  it('refuses an empty prefix, which would match every user', async () => {
    const outcome = await repository.deleteByUsernamePrefix('').then(
      () => 'resolved',
      (error: unknown) => String(error),
    );
    expect(outcome).toContain('non-empty prefix');
    expect(await repository.findByUsername(`other${tag}`)).toBeDefined();
  });
});
