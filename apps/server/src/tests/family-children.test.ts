import { describe, it, expect, mock } from 'bun:test';

const getChildIds = mock(async (_parentId: string) => ['c1', 'c2']);
const findByIds = mock(async (ids: string[]) => ids.map((id) => ({ id, isActive: id === 'c1' })));
mock.module('../modules/family/parent-child.repository', () => ({ parentChildRepository: { getChildIds } }));
mock.module('../modules/auth/index', () => ({ usersRepository: { findByIds } }));

const { listChildren } = await import('../modules/family/children');

describe('listChildren', () => {
  it("reads the parent's child ids, then their accounts", async () => {
    await listChildren('p1');

    expect(getChildIds).toHaveBeenCalledWith('p1');
    expect(findByIds).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('keeps only active children by default', async () => {
    expect((await listChildren('p1')).map((c) => c.id)).toEqual(['c1']);
  });

  it('keeps inactive children when asked, for billing', async () => {
    expect((await listChildren('p1', { includeInactive: true })).map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});
