/**
 * Tests — ParentChildRepository
 * Pattern state-based : le mock alimente un tableau `rows` en mémoire.
 * Les assertions portent sur l'état des données, pas sur le nombre d'appels.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCKS — must precede repository import
// ============================================

type Row = { id: string; parentUserId: string; childUserId: string };

let rows: Row[] = [];
let idCounter = 0;

// Insert mocké : n'insère que si la paire n'existe pas déjà (simule onConflictDoNothing)
const mockOnConflictDoNothing = mock(async () => []);

const mockInsertValues = mock((vals: { parentUserId: string; childUserId: string }) => {
  const alreadyExists = rows.some(
    (r) => r.parentUserId === vals.parentUserId && r.childUserId === vals.childUserId,
  );
  if (!alreadyExists) {
    rows.push({ id: String(++idCounter), ...vals });
  }
  return { onConflictDoNothing: mockOnConflictDoNothing };
});

const mockInsert = mock(() => ({
  values: mockInsertValues,
}));

// Delete mocké
const mockDeleteWhere = mock(async () => []);
const mockDelete = mock(() => ({ where: mockDeleteWhere }));

// Select mocké : chaîne select().from().where() et select().from().where().limit()
// Le mock intercepte la chaîne et retourne les données depuis `rows`.
// On stocke les filtres dans une closure partagée par appel.

type SelectField = 'childUserId' | 'parentUserId' | 'id';

let pendingField: SelectField = 'id';
let pendingFilterKey: 'parentUserId' | 'childUserId' | null = null;
let pendingFilterValue: string | null = null;

function filterRows(): Row[] {
  if (pendingFilterKey && pendingFilterValue !== null) {
    const key = pendingFilterKey;
    const val = pendingFilterValue;
    return rows.filter((r) => r[key] === val);
  }
  return [];
}

const mockSelectLimit = mock(async (_n: number) => {
  const matched = filterRows();
  return matched.length > 0 ? [{ id: matched[0].id }] : [];
});

const mockSelectWhere = mock(async (_condition: unknown) => {
  return filterRows().map((r) => ({ [pendingField]: r[pendingField] }));
});

const mockSelectFrom = mock((_table: unknown) => ({
  where: (_condition: unknown) => ({
    // Pour getChildIds / getParentIds (await direct)
    then: (resolve: (v: Array<Record<string, string>>) => unknown, reject: (e: unknown) => unknown) =>
      mockSelectWhere(null).then(resolve, reject),
    // Pour isLinked (.limit(1))
    limit: mockSelectLimit,
  }),
}));

const mockSelect = mock((fields?: Record<string, unknown>) => {
  if (fields) {
    const keys = Object.keys(fields);
    if (keys.includes('childUserId')) pendingField = 'childUserId';
    else if (keys.includes('parentUserId')) pendingField = 'parentUserId';
    else pendingField = 'id';
  }
  return { from: mockSelectFrom };
});

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
  select: mockSelect,
};

mock.module('../db/connection', () => ({ db: mockDb }));

// Import after mocks
const { parentChildRepository } = await import('../db/repositories/parent-child.repository');

// ============================================
// Helper : configure le filtre pour le prochain select
// ============================================

function setupFilter(key: 'parentUserId' | 'childUserId', value: string) {
  pendingFilterKey = key;
  pendingFilterValue = value;
}

// ============================================
// Tests
// ============================================

describe('ParentChildRepository', () => {
  beforeEach(() => {
    rows = [];
    idCounter = 0;
    pendingFilterKey = null;
    pendingFilterValue = null;
    pendingField = 'id';
    mockInsert.mockClear();
    mockInsertValues.mockClear();
    mockOnConflictDoNothing.mockClear();
    mockDelete.mockClear();
    mockDeleteWhere.mockClear();
    mockSelect.mockClear();
    mockSelectFrom.mockClear();
    mockSelectWhere.mockClear();
    mockSelectLimit.mockClear();
  });

  // ---- link ----

  it('link insère la paire (rows.length === 1)', async () => {
    await parentChildRepository.link('p1', 'c1');
    expect(rows.length).toBe(1);
    expect(rows[0].parentUserId).toBe('p1');
    expect(rows[0].childUserId).toBe('c1');
  });

  it('link idempotent : deux appels identiques → rows.length === 1', async () => {
    await parentChildRepository.link('p1', 'c1');
    await parentChildRepository.link('p1', 'c1');
    expect(rows.length).toBe(1);
  });

  it('un enfant peut être lié à deux parents : rows.length === 2', async () => {
    await parentChildRepository.link('p1', 'c1');
    await parentChildRepository.link('p2', 'c1');
    expect(rows.length).toBe(2);
  });

  // ---- unlink ----

  it('unlink appelle delete', async () => {
    await parentChildRepository.unlink('p1', 'c1');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  // ---- getChildIds ----

  it('getChildIds retourne les childUserId pour un parent', async () => {
    rows.push({ id: '1', parentUserId: 'p1', childUserId: 'c1' });
    rows.push({ id: '2', parentUserId: 'p1', childUserId: 'c2' });
    setupFilter('parentUserId', 'p1');
    const result = await parentChildRepository.getChildIds('p1');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('c1');
    expect(result).toContain('c2');
  });

  // ---- getParentIds ----

  it('getParentIds retourne les parentUserId pour un enfant', async () => {
    rows.push({ id: '1', parentUserId: 'p1', childUserId: 'c1' });
    rows.push({ id: '2', parentUserId: 'p2', childUserId: 'c1' });
    setupFilter('childUserId', 'c1');
    const result = await parentChildRepository.getParentIds('c1');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('p1');
    expect(result).toContain('p2');
  });

  // ---- isLinked ----

  it('isLinked retourne true quand la paire existe', async () => {
    rows.push({ id: '1', parentUserId: 'p1', childUserId: 'c1' });
    setupFilter('parentUserId', 'p1');
    const result = await parentChildRepository.isLinked('p1', 'c1');
    expect(result).toBe(true);
  });

  it('isLinked retourne false quand la paire est absente', async () => {
    const result = await parentChildRepository.isLinked('p1', 'c1');
    expect(result).toBe(false);
  });
});
