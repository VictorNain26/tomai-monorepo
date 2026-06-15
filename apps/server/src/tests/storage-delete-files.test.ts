/**
 * Unit tests for deleteFiles (batch S3 DeleteObjects).
 * Mocks the AWS SDK so we can assert chunking (1000/req), Errors mapping, and
 * the never-throws contract without hitting Scaleway.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: {
    SCALEWAY_ACCESS_KEY: 'test-key',
    SCALEWAY_SECRET_KEY: 'test-secret',
    SCALEWAY_BUCKET: 'test-bucket',
    SCALEWAY_REGION: 'fr-par',
    SCALEWAY_ENDPOINT: 'https://s3.fr-par.scw.cloud',
  },
}));

interface DeleteInput { Delete: { Objects: { Key: string }[] } }
let sendImpl: (input: DeleteInput) => Promise<unknown> = () =>
  Promise.resolve({ Deleted: [], Errors: [] });
const sentInputs: DeleteInput[] = [];

class DeleteObjectsCommand {
  constructor(public input: DeleteInput) {}
}
class Noop {
  constructor(public input?: unknown) {}
}

mock.module('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send(cmd: { input: DeleteInput }) {
      sentInputs.push(cmd.input);
      return sendImpl(cmd.input);
    }
  },
  PutObjectCommand: Noop,
  GetObjectCommand: Noop,
  DeleteObjectCommand: Noop,
  DeleteObjectsCommand,
  HeadObjectCommand: Noop,
}));
mock.module('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mock(() => Promise.resolve('https://signed')),
}));

const { deleteFiles } = await import('../services/storage/scaleway-storage.service');

beforeEach(() => {
  sentInputs.length = 0;
  sendImpl = () => Promise.resolve({ Deleted: [], Errors: [] });
  mockLogger.error.mockClear?.();
});

describe('deleteFiles (batch S3 DeleteObjects)', () => {
  it('returns {0,[]} and makes no S3 call for an empty list', async () => {
    const res = await deleteFiles([]);
    expect(res).toEqual({ deleted: 0, failed: [] });
    expect(sentInputs.length).toBe(0);
  });

  it('deletes all keys in one request under the 1000 limit', async () => {
    sendImpl = () => Promise.resolve({ Deleted: [{ Key: 'a' }, { Key: 'b' }], Errors: [] });
    const res = await deleteFiles(['a', 'b']);
    expect(sentInputs.length).toBe(1);
    expect(sentInputs[0]?.Delete.Objects).toEqual([{ Key: 'a' }, { Key: 'b' }]);
    expect(res).toEqual({ deleted: 2, failed: [] });
  });

  it('chunks keys into batches of 1000', async () => {
    sendImpl = (input) => Promise.resolve({ Deleted: input.Delete.Objects, Errors: [] });
    const keys = Array.from({ length: 2500 }, (_, i) => `k${i}`);
    const res = await deleteFiles(keys);
    expect(sentInputs.length).toBe(3); // 1000 + 1000 + 500
    expect(sentInputs.map((i) => i.Delete.Objects.length)).toEqual([1000, 1000, 500]);
    expect(res.deleted).toBe(2500);
    expect(res.failed).toEqual([]);
  });

  it('maps S3 Errors to failed keys', async () => {
    sendImpl = () =>
      Promise.resolve({ Deleted: [{ Key: 'a' }], Errors: [{ Key: 'b', Message: 'denied' }] });
    const res = await deleteFiles(['a', 'b']);
    expect(res.deleted).toBe(1);
    expect(res.failed).toEqual(['b']);
  });

  it('treats a thrown send() as the whole chunk failed and never throws', async () => {
    sendImpl = () => Promise.reject(new Error('network'));
    const res = await deleteFiles(['a', 'b']);
    expect(res.deleted).toBe(0);
    expect(res.failed).toEqual(['a', 'b']);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
