import { describe, it, expect, afterAll } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('files the chat reads — from postgres', () => {
  const stamp = Date.now();
  const studentId = `files_${stamp}`;
  const otherId = `files_other_${stamp}`;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db
      .delete(user)
      .where(inArray(user.id, [studentId, otherId]))
      .catch(() => null);
  });

  const file = (userId: string, fileName: string, status: 'ready' | 'pending') => ({
    userId,
    fileName,
    mimeType: 'image/png',
    sizeBytes: 1,
    storageKey: `${userId}/${fileName}`,
    status,
  });

  it("finds the user's own uploaded files only, never another user's nor an unfinished upload", async () => {
    const { db } = await import('../db/connection');
    const { user, files } = await import('../db/schema');
    await db.insert(user).values([studentId, otherId].map((id) => ({ id, email: `${id}@internal.tomai` })));
    const [own] = await db
      .insert(files)
      .values(file(studentId, 'own.png', 'ready'))
      .returning({ id: files.id });
    const [pending] = await db
      .insert(files)
      .values(file(studentId, 'pending.png', 'pending'))
      .returning({ id: files.id });
    const [other] = await db
      .insert(files)
      .values(file(otherId, 'other.png', 'ready'))
      .returning({ id: files.id });
    if (!own || !pending || !other) throw new Error('files not created');
    const { filesRepository } = await import('../modules/documents/files.repository');

    const found = await filesRepository.findReadyOwnedBy(studentId, [own.id, pending.id, other.id]);

    expect(found.map((f) => f.fileName)).toEqual(['own.png']);
  });

  it('gives the session files in the order they were attached', async () => {
    const { db } = await import('../db/connection');
    const { files, sessionFiles } = await import('../db/schema');
    const { studySessions } = await import('../modules/tutor/session.schema');
    const [session] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    if (!session) throw new Error('session not created');
    const names = ['third.png', 'first.png', 'second.png'];
    const ids: Record<string, string> = {};
    for (const name of names) {
      const [row] = await db
        .insert(files)
        .values(file(studentId, name, 'ready'))
        .returning({ id: files.id });
      if (!row) throw new Error('file not created');
      ids[name] = row.id;
    }
    await db.insert(sessionFiles).values([
      { sessionId: session.id, fileId: ids['first.png'] ?? '', attachedAt: new Date(stamp) },
      { sessionId: session.id, fileId: ids['second.png'] ?? '', attachedAt: new Date(stamp + 1000) },
      { sessionId: session.id, fileId: ids['third.png'] ?? '', attachedAt: new Date(stamp + 2000) },
    ]);
    const { sessionFilesRepository } = await import('../modules/documents/session-files.repository');

    const found = await sessionFilesRepository.findBySessionWithContext(session.id);

    expect(found.map((f) => f.fileName)).toEqual(['first.png', 'second.png', 'third.png']);
  });
});
