/**
 * Mock DB - Chainable Drizzle mock factories
 *
 * Each factory returns an object with chainable `.from()`, `.where()`, etc.
 * matching the Drizzle query builder pattern.
 */

import { mock } from 'bun:test';

type MockFn = ReturnType<typeof mock>;

interface ChainableMock {
  from: MockFn;
  where: MockFn;
  limit: MockFn;
  orderBy: MockFn;
  innerJoin: MockFn;
  returning: MockFn;
  onConflictDoUpdate: MockFn;
  set: MockFn;
  values: MockFn;
  target: MockFn;
}

function createChainable(finalValue: unknown): ChainableMock {
  const self: ChainableMock = {} as ChainableMock;

  const chain = (val?: unknown) => {
    const resolved = val !== undefined ? val : finalValue;
    return typeof resolved === 'function' ? resolved() : resolved;
  };

  self.from = mock(() => self);
  self.where = mock(() => self);
  self.limit = mock(() => chain());
  self.orderBy = mock(() => self);
  self.innerJoin = mock(() => self);
  self.returning = mock(() => chain());
  self.onConflictDoUpdate = mock(() => chain());
  self.set = mock(() => self);
  self.values = mock(() => self);
  self.target = mock(() => self);

  return self;
}

/**
 * Mock db.select() chain that resolves to `rows`
 */
export function mockDbSelect(rows: unknown[] = []) {
  return createChainable(rows);
}

/**
 * Mock db.insert() chain
 */
export function mockDbInsert(returning: unknown[] = []) {
  return createChainable(returning);
}

/**
 * Mock db.update() chain
 */
export function mockDbUpdate(result?: { rowCount?: number }) {
  return createChainable(result ?? { rowCount: 1 });
}

/**
 * Mock db.delete() chain
 */
export function mockDbDelete(result?: { rowCount?: number }) {
  return createChainable(result ?? { rowCount: 1 });
}

/**
 * Create a full mock db object with select/insert/update/delete/execute/transaction/query
 */
export function createMockDb(overrides?: {
  select?: ReturnType<typeof mockDbSelect>;
  insert?: ReturnType<typeof mockDbInsert>;
  update?: ReturnType<typeof mockDbUpdate>;
  delete?: ReturnType<typeof mockDbDelete>;
  execute?: MockFn;
  transaction?: MockFn;
  query?: Record<string, unknown>;
}) {
  return {
    select: mock(() => overrides?.select ?? mockDbSelect()),
    insert: mock(() => overrides?.insert ?? mockDbInsert()),
    update: mock(() => overrides?.update ?? mockDbUpdate()),
    delete: mock(() => overrides?.delete ?? mockDbDelete()),
    execute: overrides?.execute ?? mock(() => Promise.resolve([{ count: 1 }])),
    transaction: overrides?.transaction ?? mock((fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: () => mockDbInsert(),
      select: () => mockDbSelect(),
      update: () => mockDbUpdate(),
      delete: () => mockDbDelete(),
    })),
    query: overrides?.query ?? {},
  };
}
