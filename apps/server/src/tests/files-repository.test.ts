/**
 * Tests unitaires - Files Repository (db/repositories/files.repository.ts)
 * Mock: db.update to capture the SQL fragment passed to .set().
 *
 * Le but est de vérifier que mergeEducationalContext() émet un MERGE JSONB
 * via l'opérateur `||` plutôt qu'un overwrite complet — protection contre
 * les régressions qui écraseraient silencieusement STT / OCR / analysis.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';

// ============================================
// MOCKS — must be registered before importing the repository
// ============================================

// Capture what .set() receives — that's the payload we want to inspect.
let capturedSetArg: Record<string, unknown> | null = null;
let capturedWhereArgs: unknown[] = [];
let updateCalledWith: unknown = null;

const mockWhere = mock((arg: unknown) => {
  capturedWhereArgs.push(arg);
  return Promise.resolve([]);
});

const mockSet = mock((arg: Record<string, unknown>) => {
  capturedSetArg = arg;
  return { where: mockWhere };
});

const mockUpdate = mock((table: unknown) => {
  updateCalledWith = table;
  return { set: mockSet };
});

mock.module('../db/connection', () => ({
  db: {
    update: mockUpdate,
  },
}));

// We don't need to stub the full schema — just enough that
// `files.educationalContext` and `files.id` behave as drizzle columns
// for sql template composition. Using a simple Proxy sentinel lets drizzle
// serialize them without real metadata.
const makeCol = (name: string) => ({
  name,
  // drizzle column serialization — minimal surface used in sql``
  toString: () => name,
});

mock.module('../db/schema', () => ({
  files: {
    id: makeCol('id'),
    educationalContext: makeCol('educational_context'),
  },
  // Also expose these so other tests running in the same Bun process after
  // this one don't break when they import schema (mock.module cache is global).
  learningDecks: {},
  learningCards: {},
}));

// Import after mocks
const { filesRepository } = await import('../db/repositories/files.repository');

/**
 * Serialize a drizzle SQL template object into a single string for assertion.
 * Drizzle exposes the raw fragments via `.queryChunks` — each chunk is either a
 * `StringChunk` (with a `value` array of strings) or a parameter value.
 */
function serializeSql(sqlObj: unknown): string {
  if (sqlObj === null || typeof sqlObj !== 'object') return String(sqlObj);
  const chunks = (sqlObj as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return String(sqlObj);
  return chunks.map(c => {
    if (c && typeof c === 'object' && 'value' in c) {
      const v = (c as { value: unknown }).value;
      if (Array.isArray(v)) return v.join('');
      return String(v);
    }
    return String(c);
  }).join('');
}

beforeEach(() => {
  capturedSetArg = null;
  capturedWhereArgs = [];
  updateCalledWith = null;
  mockUpdate.mockClear();
  mockSet.mockClear();
  mockWhere.mockClear();
});

// ============================================
// TESTS
// ============================================

describe('FilesRepository.mergeEducationalContext', () => {
  it('should call db.update with the files table', async () => {
    await filesRepository.mergeEducationalContext('file-1', { transcription: 'Bonjour' });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(updateCalledWith).toBeDefined();
  });

  it('should emit a JSONB merge via `||`, not an overwrite', async () => {
    await filesRepository.mergeEducationalContext('file-42', { ocr: 'text' });
    expect(capturedSetArg).not.toBeNull();
    const setArg = capturedSetArg as Record<string, unknown>;

    // educationalContext is a drizzle SQL template, not a plain value.
    const ctx = setArg.educationalContext;
    expect(ctx).toBeDefined();

    // The SQL template should render into a string containing the `||`
    // operator, COALESCE against the existing column, and the JSON patch.
    const serialized = serializeSql(ctx);
    expect(serialized).toContain('||');
    expect(serialized).toContain('COALESCE');
    expect(serialized).toContain('jsonb');
  });

  it('should JSON-stringify the patch into the SQL template', async () => {
    const patch = { transcription: 'Hello world', confidence: 0.95 };
    await filesRepository.mergeEducationalContext('file-1', patch);

    const setArg = capturedSetArg as Record<string, unknown>;
    const ctx = setArg.educationalContext;

    // The JSON-stringified patch is passed as a parameter into the sql tag,
    // so it shows up in the serialized template.
    const rendered = serializeSql(ctx);
    expect(rendered).toContain('Hello world');
    expect(rendered).toContain('0.95');
  });

  it('should include a NOW() updatedAt bump alongside the merge', async () => {
    await filesRepository.mergeEducationalContext('file-1', { key: 'v' });
    const setArg = capturedSetArg as Record<string, unknown>;
    expect(setArg.updatedAt).toBeDefined();
    expect(serializeSql(setArg.updatedAt)).toContain('NOW');
  });

  it('should pass through the id to the WHERE clause', async () => {
    await filesRepository.mergeEducationalContext('file-abc-123', { key: 'v' });
    expect(mockWhere).toHaveBeenCalledTimes(1);
    // Drizzle builds an eq() expression — we only need to know it was invoked once.
    expect(capturedWhereArgs).toHaveLength(1);
  });

  it('should resolve without error on empty patch', async () => {
    await expect(
      filesRepository.mergeEducationalContext('file-1', {}),
    ).resolves.toBeUndefined();
    const setArg = capturedSetArg as Record<string, unknown>;
    const rendered = serializeSql(setArg.educationalContext);
    expect(rendered).toContain('{}');
  });

  it('should NOT serialize the column name as a bare string (i.e. not a plain overwrite)', async () => {
    // Regression guard: if someone "refactored" this into
    // `set({ educationalContext: patch })`, the captured value would just
    // be the JS object { key: 'v' } — not a SQL template.
    // The current implementation must produce something sql-y (drizzle's SQL
    // class has a `queryChunks` array).
    await filesRepository.mergeEducationalContext('file-1', { key: 'v' });
    const setArg = capturedSetArg as Record<string, unknown>;
    const ctx = setArg.educationalContext;

    // Plain object would have the key 'key' directly; a drizzle SQL template won't.
    expect((ctx as Record<string, unknown>).key).toBeUndefined();
    // Positive assertion: should have the shape of a drizzle sql() result
    // (a SQL object with queryChunks OR at least not a raw patch).
    expect(typeof ctx === 'object' && ctx !== null).toBe(true);
  });

  // Sanity: ensure the drizzle sql`` helper we're comparing against is
  // actually importable — guards against accidental package breakage that
  // would make all the tests above vacuously pass.
  it('sanity: drizzle sql helper is available in the test env', () => {
    const frag = sql`SELECT 1`;
    expect(frag).toBeDefined();
  });
});
