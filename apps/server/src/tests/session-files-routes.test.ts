import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const signedIn = () => Promise.resolve({ success: true as const, user: { id: 'student-1', role: 'student' }, session: {} });
  return { requireAuth: signedIn, requireParentRole: signedIn };
});

const FILE_ID = '0199a3c4-7b1e-7d2a-9f00-0000000000f1';
const SESSION_ID = '0199a3c4-7b1e-7d2a-9f00-0000000000a1';

let fileOwner = 'student-1';
let sessionOwner = 'student-1';
let attachedCount = 0;
const attach = mock(async (_sessionId: string, _fileId: string) => {});
const detach = mock(async (_sessionId: string, _fileId: string) => true);
mock.module('../modules/documents/index', () => ({
  filesRepository: { findById: mock(async (id: string) => ({ id, userId: fileOwner })) },
  sessionFilesRepository: { attach, detach, countBySession: mock(async () => attachedCount) },
}));
mock.module('../modules/tutor/study-sessions.repository', () => ({
  studySessionsRepository: { findById: mock(async (id: string) => ({ id, userId: sessionOwner })) },
}));

const { sessionFilesRoutes } = await import('../modules/tutor/session-files.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>().route('/api', sessionFilesRoutes).onError(handleError);

const attachRequest = () => app.request(`/api/chat/session/${SESSION_ID}/files`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileId: FILE_ID }),
});

beforeEach(() => {
  fileOwner = 'student-1';
  sessionOwner = 'student-1';
  attachedCount = 0;
  attach.mockClear();
  detach.mockClear();
});

describe('POST /api/chat/session/:id/files', () => {
  it('attaches a file the student owns to a session the student owns', async () => {
    const res = await attachRequest();

    expect(res.status).toBe(200);
    expect(attach).toHaveBeenCalledWith(SESSION_ID, FILE_ID);
  });

  it("refuses another student's session", async () => {
    sessionOwner = 'student-2';

    expect((await attachRequest()).status).toBe(403);
    expect(attach).not.toHaveBeenCalled();
  });

  it("refuses another student's file", async () => {
    fileOwner = 'student-2';

    expect((await attachRequest()).status).toBe(403);
    expect(attach).not.toHaveBeenCalled();
  });

  it('stops at ten files per session', async () => {
    attachedCount = 10;

    expect((await attachRequest()).status).toBe(400);
    expect(attach).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/chat/session/:id/files/:fileId', () => {
  it("refuses to detach from another student's session", async () => {
    sessionOwner = 'student-2';

    const res = await app.request(`/api/chat/session/${SESSION_ID}/files/${FILE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(403);
    expect(detach).not.toHaveBeenCalled();
  });
});
