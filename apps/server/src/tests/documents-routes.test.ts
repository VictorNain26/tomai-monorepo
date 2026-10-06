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
mock.module('../modules/voice/index', () => ({ getVoxtralTranscribeService: () => ({}) }));

const FILE_ID = '0199a3c4-7b1e-7d2a-9f00-0000000000f1';
let fileOwner = 'student-1';
let listedFiles: Record<string, unknown>[] = [];
const hardDelete = mock(async (_id: string) => true);
const findByUserId = mock(async (_userId: string) => listedFiles);
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: {
    findById: mock(async (id: string) => ({ id, userId: fileOwner, storageKey: 'uploads/k' })),
    hardDelete,
    findByUserId,
  },
}));

let storageDeleted = true;
mock.module('../modules/documents/storage', () => ({
  deleteFile: mock(async () => storageDeleted),
}));

const { uploadRoutes } = await import('../modules/documents/upload.routes');
const { filesRoutes } = await import('../modules/documents/files.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>()
  .route('/api/upload', uploadRoutes)
  .route('/api', filesRoutes)
  .onError(handleError);

beforeEach(() => {
  fileOwner = 'student-1';
  listedFiles = [];
  storageDeleted = true;
  hardDelete.mockClear();
  findByUserId.mockClear();
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

describe('GET /api/files', () => {
  it("lists the student's files", async () => {
    const createdAt = new Date('2026-10-01T08:00:00Z');
    listedFiles = [
      { id: FILE_ID, fileName: 'ex.pdf', mimeType: 'application/pdf', sizeBytes: 12, educationalContext: { extractedText: 'x' }, createdAt },
      { id: 'f2', fileName: 'photo.png', mimeType: 'image/png', sizeBytes: 34, educationalContext: null, createdAt },
    ];

    const res = await app.request('/api/files');

    expect(res.status).toBe(200);
    expect(findByUserId).toHaveBeenCalledWith('student-1');
    expect(await res.json()).toEqual({
      success: true,
      files: [
        { id: FILE_ID, fileName: 'ex.pdf', mimeType: 'application/pdf', sizeBytes: 12, createdAt: '2026-10-01T08:00:00.000Z' },
        { id: 'f2', fileName: 'photo.png', mimeType: 'image/png', sizeBytes: 34, createdAt: '2026-10-01T08:00:00.000Z' },
      ],
    });
  });

  it('answers 500 when the files cannot be read', async () => {
    findByUserId.mockImplementationOnce(async () => {
      throw new Error('db down');
    });

    expect((await app.request('/api/files')).status).toBe(500);
  });
});
