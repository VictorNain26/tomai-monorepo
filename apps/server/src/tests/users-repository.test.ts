import { describe, it, expect, mock, beforeEach } from 'bun:test';

const rows = [{ id: 'c1' }, { id: 'c2' }];
const where = mock(async (_condition: unknown) => rows);
const from = mock((_table: unknown) => ({ where }));
const select = mock(() => ({ from }));
mock.module('../db/connection', () => ({ db: { select } }));

const { usersRepository } = await import('../modules/auth/users.repository');

beforeEach(() => {
  select.mockClear();
  where.mockClear();
});

describe('usersRepository.findByIds', () => {
  it('returns no user without querying when there are no ids', async () => {
    expect(await usersRepository.findByIds([])).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it('reads the users of the given ids in one query', async () => {
    expect((await usersRepository.findByIds(['c1', 'c2'])).map((u) => u.id)).toEqual(['c1', 'c2']);
    expect(select).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
