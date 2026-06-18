/**
 * Tests — usersRepository children via parent_child junction
 * Vérifie que findChildrenByParentId et findAllChildrenByParentId
 * font un INNER JOIN sur parent_child (plus de filtre user.parentId).
 */

import { describe, it, expect, mock } from 'bun:test';
import type { User } from '../db/schema/auth.schema';
import { parentChild } from '../db/schema/auth.schema';

// ============================================
// MOCKS — must precede repository import
// ============================================

const fakeUser = { id: 'c1', isActive: true } as unknown as User;

const mockWhere = mock(async () => [{ user: fakeUser, parent_child: { parentUserId: 'p1', childUserId: 'c1' } as Record<string, string> }]);

const mockInnerJoin = mock((_table: unknown, _condition: unknown) => ({
  where: mockWhere,
}));

const mockFrom = mock((_table: unknown) => ({
  innerJoin: mockInnerJoin,
}));

const mockDb = {
  select: mock(() => ({ from: mockFrom })),
};

mock.module('../db/connection', () => ({ db: mockDb }));

// Import after mocks
const usersRepository = await import('../db/repositories/users.repository');

// ============================================
// Tests
// ============================================

describe('usersRepository children via parent_child junction', () => {
  it('findChildrenByParentId joint parent_child et retourne User[]', async () => {
    const children = await usersRepository.usersRepository.findChildrenByParentId('p1');
    expect(mockFrom).toHaveBeenCalledWith(parentChild);
    expect(mockInnerJoin).toHaveBeenCalled();
    expect(children).toEqual([fakeUser]);
  });

  it('findAllChildrenByParentId joint parent_child et retourne User[]', async () => {
    const children = await usersRepository.usersRepository.findAllChildrenByParentId('p1');
    expect(mockFrom).toHaveBeenCalledWith(parentChild);
    expect(mockInnerJoin).toHaveBeenCalled();
    expect(children).toEqual([fakeUser]);
  });
});
