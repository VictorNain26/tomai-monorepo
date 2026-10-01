import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const signedIn = () => Promise.resolve({ success: true as const, user: { id: 'student-1', role: 'student' }, session: {} });
  return { requireAuth: signedIn, requireParentRole: signedIn };
});
mock.module('../platform/config/env', () => ({
  env: {},
  isProduction: () => false,
  isDevelopment: () => true,
  getCorsOrigins: () => [],
}));
mock.module('../db/connection', () => ({ db: {} }));
mock.module('../modules/voice/index', () => ({ audioTranscriptionService: {} }));

const FILE_ID = '0199a3c4-7b1e-7d2a-9f00-0000000000f1';
const SESSION_ID = '0199a3c4-7b1e-7d2a-9f00-0000000000a1';

let fileOwner = 'student-1';
let sessionOwner = 'student-1';
const hardDelete = mock(async (_id: string) => true);
const attach = mock(async (_sessionId: string, _fileId: string) => {});
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: {
    findById: mock(async (id: string) => ({ id, userId: fileOwner, storageKey: 'uploads/k' })),
    hardDelete,
  },
}));
mock.module('../modules/documents/session-files.repository', () => ({
  sessionFilesRepository: { attach, countBySession: mock(async () => 0) },
}));
mock.module('../db/repositories/study-sessions.repository', () => ({
  studySessionsRepository: { findById: mock(async (id: string) => ({ id, userId: sessionOwner })) },
}));

let storageDeleted = true;
mock.module('../modules/documents/storage', () => ({
  deleteFile: mock(async () => storageDeleted),
}));

const { uploadRoutes } = await import('../modules/documents/upload.routes');
const { sessionFilesRoutes } = await import('../modules/documents/session-files.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>()
  .route('/api/upload', uploadRoutes)
  .route('/api', sessionFilesRoutes)
  .onError(handleError);

beforeEach(() => {
  fileOwner = 'student-1';
  sessionOwner = 'student-1';
  storageDeleted = true;
  hardDelete.mockClear();
  attach.mockClear();
});

describe('DELETE /api/upload/file/:fileId', () => {
  it('deletes the object, then the row', async () => {
    const res = await app.request(`/api/upload/file/${FILE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(hardDelete).toHaveBeenCalledWith(FILE_ID);
  });

  it('keeps the row when the storage delete fails, so the object is never orphaned', async () => {
    storageDeleted = false;

    const res = await app.request(`/api/upload/file/${FILE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(500);
    expect(hardDelete).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat/session/:id/files', () => {
  const attachRequest = () => app.request(`/api/chat/session/${SESSION_ID}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: FILE_ID }),
  });

  it('attaches a file the student owns to a session the student owns', async () => {
    const res = await attachRequest();

    expect(res.status).toBe(200);
    expect(attach).toHaveBeenCalledWith(SESSION_ID, FILE_ID);
  });

  it("refuses another student's session", async () => {
    sessionOwner = 'student-2';

    const res = await attachRequest();

    expect(res.status).toBe(403);
    expect(attach).not.toHaveBeenCalled();
  });
});
