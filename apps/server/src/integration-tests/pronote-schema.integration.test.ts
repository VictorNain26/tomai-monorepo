/**
 * Tests — pronote schema: display columns + (credential_id, resource_id) uniqueness
 *
 * Requires a real Postgres dev DB.
 * Skips cleanly if the DB is unreachable (offline CI).
 *
 * What is tested:
 *   1. pronoteCredentials exposes the new `establishmentName` column in its schema object.
 *   2. pronoteChildResources exposes the new `className` and `establishmentName` columns.
 *   3. The DB-level unique constraint on (credential_id, resource_id) rejects a second
 *      insert with the same pair but a different childUserId.
 *
 * Cleanup: all probe rows are deleted via FK cascade on parent user deletion.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'crypto';
import { sql, like } from 'drizzle-orm';
import { db } from '../db/connection.js';
import {
  pronoteCredentials,
  pronoteChildResources,
} from '../db/schema/pronote.schema.js';
import { user as userTable } from '../db/schema.js';

// ============================================================
// Reachability
// ============================================================

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

if (!dbReachable) {
  console.warn('[pronote-schema] DB unreachable — constraint tests will be skipped');
}

// ============================================================
// Probe state
// ============================================================

const PROBE_PREFIX = `probe-schema-${Date.now()}`;

let parentId: string;
let credentialId: string;
let childAId: string;
let childBId: string;

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  if (!dbReachable) return;

  // Parent user
  const [parent] = await db
    .insert(userTable)
    .values({
      id: randomUUID(),
      email: `${PROBE_PREFIX}-parent@example.test`,
      name: 'Schema Probe Parent',
      role: 'parent',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!parent) throw new Error('Failed to insert probe parent');
  parentId = parent.id;

  // Child A
  const [childA] = await db
    .insert(userTable)
    .values({
      id: randomUUID(),
      email: `${PROBE_PREFIX}-child-a@example.test`,
      name: 'Schema Probe Child A',
      role: 'student',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!childA) throw new Error('Failed to insert probe child A');
  childAId = childA.id;

  // Child B
  const [childB] = await db
    .insert(userTable)
    .values({
      id: randomUUID(),
      email: `${PROBE_PREFIX}-child-b@example.test`,
      name: 'Schema Probe Child B',
      role: 'student',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!childB) throw new Error('Failed to insert probe child B');
  childBId = childB.id;

  // Credential row
  const [cred] = await db
    .insert(pronoteCredentials)
    .values({
      id: randomUUID(),
      userId: parentId,
      encryptedToken: 'schema-test-placeholder',
      encryptedMetadata: 'schema-test-placeholder',
      establishmentUrl: 'https://school.example.test/pronote/',
      tokenExpiresAt: new Date('2099-01-01'),
    })
    .returning();
  if (!cred) throw new Error('Failed to insert probe credential');
  credentialId = cred.id;
});

afterAll(async () => {
  if (!dbReachable) return;
  // Cascade: deleting the parent user removes credentials and child_resources via FK cascade.
  await db.delete(userTable).where(like(userTable.email, `${PROBE_PREFIX}%@example.test`));
});

// ============================================================
// Schema structural tests (no DB required)
// ============================================================

describe('pronote schema — display columns', () => {
  it('pronoteCredentials exposes establishmentName column', () => {
    const cols = Object.keys(pronoteCredentials);
    expect(cols).toContain('establishmentName');
  });

  it('pronoteChildResources exposes className column', () => {
    const cols = Object.keys(pronoteChildResources);
    expect(cols).toContain('className');
  });

  it('pronoteChildResources exposes establishmentName column', () => {
    const cols = Object.keys(pronoteChildResources);
    expect(cols).toContain('establishmentName');
  });
});

// ============================================================
// DB-level uniqueness constraint
// ============================================================

const dbDescribe = dbReachable ? describe : describe.skip;

dbDescribe('pronote_child_resources — unique (credential_id, resource_id)', () => {
  it('inserts the first row successfully', async () => {
    const result = await db.insert(pronoteChildResources).values({
      parentUserId: parentId,
      childUserId: childAId,
      credentialId,
      resourceId: 42,
    });
    expect(result).toBeDefined();
  });

  it('rejects a second row with the same (credential_id, resource_id) but different childUserId', async () => {
    let threw = false;
    try {
      await db.insert(pronoteChildResources).values({
        parentUserId: parentId,
        childUserId: childBId,
        credentialId,
        resourceId: 42,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
