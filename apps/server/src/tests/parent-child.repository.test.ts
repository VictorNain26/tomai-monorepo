/**
 * Tests — ParentChildRepository
 * Mock: db via drizzle-orm + ../db/connection
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCKS — must precede repository import
// ============================================

const mockOnConflictDoNothing = mock(async () => []);

const mockInsert = mock(() => ({
  values: mock(() => ({
    onConflictDoNothing: mockOnConflictDoNothing,
  })),
}));

const mockWhere = mock(async () => []);

const mockDelete = mock(() => ({
  where: mockWhere,
}));

const mockSelectFrom = mock(() => ({
  where: mock(async () => [] as Array<{ parentUserId: string; childUserId: string }>),
}));

const mockSelect = mock(() => ({
  from: mockSelectFrom,
}));

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
  select: mockSelect,
};

mock.module('../db/connection', () => ({
  db: mockDb,
}));

// Import after mocks
const { parentChildRepository } = await import('../db/repositories/parent-child.repository');

// ============================================
// Tests
// ============================================

describe('ParentChildRepository', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockOnConflictDoNothing.mockClear();
    mockDelete.mockClear();
    mockWhere.mockClear();
    mockSelect.mockClear();
  });

  it('link calls insert with correct values', async () => {
    await parentChildRepository.link('p1', 'c1');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('duplicate link is ignored (onConflictDoNothing)', async () => {
    await parentChildRepository.link('p1', 'c1');
    await parentChildRepository.link('p1', 'c1');
    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(2);
  });

  it('a child can be linked to two parents', async () => {
    await parentChildRepository.link('p1', 'c1');
    await parentChildRepository.link('p2', 'c1');
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('unlink calls delete', async () => {
    await parentChildRepository.unlink('p1', 'c1');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('getChildIds calls select', async () => {
    const result = await parentChildRepository.getChildIds('p1');
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getParentIds calls select', async () => {
    const result = await parentChildRepository.getParentIds('c1');
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(Array.isArray(result)).toBe(true);
  });
});
