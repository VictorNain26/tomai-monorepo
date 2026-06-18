import { describe, it, expect, beforeEach, mock } from 'bun:test';

const linkCalls: Array<[string, string]> = [];
mock.module('../db/repositories/parent-child.repository', () => ({
  parentChildRepository: {
    link: async (p: string, c: string) => { linkCalls.push([p, c]); },
    isLinked: async (p: string, c: string) => linkCalls.some(([lp, lc]) => lp === p && lc === c),
  },
}));
mock.module('../db/repositories/users.repository', () => ({
  usersRepository: {
    findByUsername: async () => undefined,
    update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
  },
}));
mock.module('../lib/auth', () => ({
  auth: { api: { signUpEmail: async () => ({ user: { id: 'c1' } }) } },
}));

const { parentService } = await import('../services/parent.service');

describe('parentService linking via junction', () => {
  beforeEach(() => { linkCalls.length = 0; });

  it('createChild links parent and child in the junction', async () => {
    await parentService.createChild('p1', {
      firstName: 'Léa', lastName: 'Martin', username: 'lea.martin',
      password: 'temp-pass-123', schoolLevel: 'seconde', dateOfBirth: '2009-05-01',
    });
    expect(linkCalls).toContainEqual(['p1', 'c1']);
  });

  it('isParentOf is true only when a link exists', async () => {
    await parentService.createChild('p1', {
      firstName: 'Léa', lastName: 'Martin', username: 'lea.martin',
      password: 'temp-pass-123', schoolLevel: 'seconde', dateOfBirth: '2009-05-01',
    });
    expect(await parentService.isParentOf('p1', 'c1')).toBe(true);
    expect(await parentService.isParentOf('p2', 'c1')).toBe(false);
  });
});
