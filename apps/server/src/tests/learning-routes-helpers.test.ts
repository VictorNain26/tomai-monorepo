import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const { getUserLevel } = await import('../modules/learning/routes.helpers');

describe('getUserLevel', () => {
  it("keeps the user's collège level", () => {
    expect(getUserLevel('u1', 'quatrieme')).toBe('quatrieme');
  });

  it('falls back to the 6e without a level, or with one outside the collège', () => {
    for (const level of [null, undefined, '', 'seconde', 'cm2']) expect(getUserLevel('u1', level)).toBe('sixieme');
  });
});
