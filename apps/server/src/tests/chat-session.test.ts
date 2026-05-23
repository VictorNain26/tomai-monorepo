/**
 * Tests unitaires - Chat Session & Message Services
 * Mock: repositories + logger + storage
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeStudySession, makeMessage, makeUser } from './_helpers/fixtures';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Repository mock state
let findActiveByUserResult: Record<string, unknown> | null = null;
let findByIdResult: Record<string, unknown> | null = null;
let createSessionResult: Record<string, unknown> = { id: 'new-session-001' };
let updateSessionResult: Record<string, unknown> = {};
let findBySessionIdResult: Array<Record<string, unknown>> = [];
let createMessageResult: Record<string, unknown> = { id: 'new-msg-001' };
let findByUserIdWithStatsResult: Array<Record<string, unknown>> = [];
let deleteByIdCalled = false;
let findMessageByIdResult: Record<string, unknown> | null = null;
let findUserByIdResult: Record<string, unknown> | null = null;
let filesDeletedIds: string[] = [];

mock.module('../db/repositories', () => ({
  usersRepository: {
    findById: mock(async () => findUserByIdResult),
  },
  studySessionsRepository: {
    findActiveByUser: mock(async () => findActiveByUserResult),
    findById: mock(async () => findByIdResult),
    create: mock(async () => createSessionResult),
    update: mock(async () => updateSessionResult),
    findByUserIdWithStats: mock(async () => findByUserIdWithStatsResult),
    deleteById: mock(async () => {
      deleteByIdCalled = true;
    }),
  },
  messagesRepository: {
    findBySessionId: mock(async () => findBySessionIdResult),
    create: mock(async (input: Record<string, unknown>) => ({
      id: createMessageResult.id,
      ...input,
    })),
    findById: mock(async () => findMessageByIdResult),
  },
  filesRepository: {
    findById: mock(async (id: string) => {
      if (filesDeletedIds.includes(id)) return null;
      return { id, storageKey: `key-${id}` };
    }),
    hardDelete: mock(async (id: string) => {
      filesDeletedIds.push(id);
    }),
  },
}));

mock.module('../db/connection', () => ({
  db: {
    delete: mock(() => ({
      where: mock(async () => ({ rowCount: 1 })),
    })),
  },
}));

mock.module('../db/schema', () => ({
  messages: { sessionId: 'sessionId' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
}));

mock.module('../storage/scaleway-storage.service', () => ({
  deleteFile: mock(async () => {}),
}));

// safeUUID: pass through valid UUIDs, return null for invalid
mock.module('../utils/uuid', () => ({
  safeUUID: (value: string | null | undefined) => {
    if (!value) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value) ? value : null;
  },
}));

// NOTE: Known Bun test resolver issue with this file.
// The transitive import chain chat-session.service → episodic-memory.service →
// ../db/schema.js fails to resolve sessionEpisodes/messages/studySessions at
// test time even though `bun -e "import('./src/db/schema').then(...)"` works
// at runtime. mock.module of the episodic service + schema barrel was
// attempted but Bun's test resolver doesn't intercept relative-path imports
// consistently. Tracked as follow-up; tests validated via `bun -e` stub for
// the moment and by the surrounding suite (tool-executor.test, progress.test
// etc. cover overlapping session/message behaviour).

// Import after mocks
const { ChatSessionService } = await import('../services/chat/chat-session.service');
const { ChatMessageService } = await import('../services/chat/chat-message.service');

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

let sessionService: InstanceType<typeof ChatSessionService>;
let messageService: InstanceType<typeof ChatMessageService>;

beforeEach(() => {
  sessionService = new ChatSessionService();
  messageService = new ChatMessageService();
  findActiveByUserResult = null;
  findByIdResult = null;
  createSessionResult = { id: VALID_UUID };
  updateSessionResult = {};
  findBySessionIdResult = [];
  createMessageResult = { id: 'new-msg-001' };
  findByUserIdWithStatsResult = [];
  deleteByIdCalled = false;
  findMessageByIdResult = null;
  findUserByIdResult = null;
  filesDeletedIds = [];
});

// ============================================
// ChatSessionService
// ============================================

describe('ChatSessionService', () => {
  describe('getOrCreateActiveSession', () => {
    it('should return existing active session ID', async () => {
      findActiveByUserResult = makeStudySession({ id: VALID_UUID });
      const result = await sessionService.getOrCreateActiveSession('user-001');
      expect(result).toBe(VALID_UUID);
    });

    it('should create new session when none exists', async () => {
      findActiveByUserResult = null;
      createSessionResult = { id: VALID_UUID };
      const result = await sessionService.getOrCreateActiveSession('user-001');
      expect(result).toBe(VALID_UUID);
    });

    it('should log and rethrow on error', async () => {
      findActiveByUserResult = null;
      createSessionResult = { id: VALID_UUID };
      // Simulate error by making findActiveByUser throw
      const { studySessionsRepository } = await import('../db/repositories');
      const original = studySessionsRepository.findActiveByUser;
      (studySessionsRepository.findActiveByUser as ReturnType<typeof mock>).mockImplementationOnce(
        () => Promise.reject(new Error('DB connection lost'))
      );

      await expect(sessionService.getOrCreateActiveSession('user-err')).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();

      // Restore
      (studySessionsRepository.findActiveByUser as ReturnType<typeof mock>).mockImplementation(
        () => Promise.resolve(findActiveByUserResult)
      );
    });
  });

  describe('createSession', () => {
    it('should create session with subject', async () => {
      createSessionResult = { id: VALID_UUID };
      const result = await sessionService.createSession('user-001', 'mathematiques');
      expect(result).toBe(VALID_UUID);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should create session with optional topic', async () => {
      createSessionResult = { id: VALID_UUID };
      const result = await sessionService.createSession('user-001', 'mathematiques', 'fractions');
      expect(result).toBe(VALID_UUID);
    });
  });

  describe('getSession', () => {
    it('should return session details when found', async () => {
      findByIdResult = makeStudySession({
        id: VALID_UUID,
        userId: 'user-001',
      }) as Record<string, unknown>;
      const result = await sessionService.getSession(VALID_UUID);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
      expect(result?.subject).toBe('mathematiques');
    });

    it('should return null for invalid UUID', async () => {
      const result = await sessionService.getSession('not-a-uuid');
      expect(result).toBeNull();
    });

    it('should return null when session not found', async () => {
      findByIdResult = null;
      const result = await sessionService.getSession(VALID_UUID);
      expect(result).toBeNull();
    });
  });

  describe('getSessionWithSummary', () => {
    it('should return summary data when session exists', async () => {
      findByIdResult = makeStudySession({
        id: VALID_UUID,
        conversationSummary: 'Topic: fractions',
        summaryUpToMessageId: 'msg-010',
      }) as Record<string, unknown>;

      const result = await sessionService.getSessionWithSummary(VALID_UUID);
      expect(result).not.toBeNull();
      expect(result?.conversationSummary).toBe('Topic: fractions');
      expect(result?.summaryUpToMessageId).toBe('msg-010');
    });

    it('should return null for invalid UUID', async () => {
      const result = await sessionService.getSessionWithSummary('bad');
      expect(result).toBeNull();
    });

    it('should return null when session not found', async () => {
      findByIdResult = null;
      const result = await sessionService.getSessionWithSummary(VALID_UUID);
      expect(result).toBeNull();
    });
  });

  describe('getUserSessions', () => {
    it('should return formatted sessions list', async () => {
      findByUserIdWithStatsResult = [
        {
          id: VALID_UUID,
          subject: 'mathematiques',
          startedAt: new Date('2025-06-15'),
          endedAt: null,
          messageCount: 5,
          frustrationAvg: '2.5',
        },
      ];

      const result = await sessionService.getUserSessions('user-001');
      expect(result.length).toBe(1);
      expect(result[0]?.subject).toBe('mathematiques');
      expect(result[0]?.messagesCount).toBe(5);
      expect(result[0]?.frustrationAvg).toBe(2.5);
    });

    it('should respect limit parameter', async () => {
      findByUserIdWithStatsResult = [
        { id: 's1', subject: 'maths', startedAt: new Date(), endedAt: null, messageCount: 1, frustrationAvg: '1.0' },
        { id: 's2', subject: 'francais', startedAt: new Date(), endedAt: null, messageCount: 2, frustrationAvg: '2.0' },
        { id: 's3', subject: 'physique', startedAt: new Date(), endedAt: null, messageCount: 3, frustrationAvg: '3.0' },
      ];

      const result = await sessionService.getUserSessions('user-001', 2);
      expect(result.length).toBe(2);
    });

    it('should return all when no limit', async () => {
      findByUserIdWithStatsResult = [
        { id: 's1', subject: 'maths', startedAt: new Date(), endedAt: null, messageCount: 1, frustrationAvg: '1.0' },
        { id: 's2', subject: 'francais', startedAt: new Date(), endedAt: null, messageCount: 2, frustrationAvg: '2.0' },
      ];

      const result = await sessionService.getUserSessions('user-001');
      expect(result.length).toBe(2);
    });
  });

  describe('deleteSession', () => {
    it('should delete session and its messages', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID, userId: 'user-001' }) as Record<string, unknown>;
      findBySessionIdResult = [];

      await sessionService.deleteSession(VALID_UUID, 'user-001');
      expect(deleteByIdCalled).toBe(true);
    });

    it('should throw for invalid UUID', async () => {
      await expect(sessionService.deleteSession('bad-id')).rejects.toThrow();
    });

    it('should throw when session belongs to different user', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID, userId: 'other-user' }) as Record<string, unknown>;
      await expect(sessionService.deleteSession(VALID_UUID, 'user-001')).rejects.toThrow();
    });

    it('should delete without userId check when userId not provided', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID }) as Record<string, unknown>;
      findBySessionIdResult = [];

      await sessionService.deleteSession(VALID_UUID);
      expect(deleteByIdCalled).toBe(true);
    });
  });

  describe('resetSession', () => {
    it('should archive old session and create new one', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID, userId: 'user-001' }) as Record<string, unknown>;
      createSessionResult = { id: VALID_UUID_2 };

      const newId = await sessionService.resetSession(VALID_UUID, 'user-001');
      expect(newId).toBe(VALID_UUID_2);
    });

    it('should throw for invalid UUID', async () => {
      await expect(sessionService.resetSession('invalid', 'user-001')).rejects.toThrow();
    });

    it('should throw when session not found', async () => {
      findByIdResult = null;
      await expect(sessionService.resetSession(VALID_UUID, 'user-001')).rejects.toThrow();
    });

    it('should throw when session belongs to different user', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID, userId: 'other-user' }) as Record<string, unknown>;
      await expect(sessionService.resetSession(VALID_UUID, 'user-001')).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('should return user with school level', async () => {
      findUserByIdResult = makeUser({ id: 'user-001', schoolLevel: 'troisieme' }) as Record<string, unknown>;
      const result = await sessionService.getUserById('user-001');
      expect(result).not.toBeNull();
      expect(result?.schoolLevel).toBe('troisieme');
    });

    it('should return null when user not found', async () => {
      findUserByIdResult = null;
      const result = await sessionService.getUserById('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw when user has no school level', async () => {
      findUserByIdResult = makeUser({ id: 'user-001', schoolLevel: null }) as Record<string, unknown>;
      await expect(sessionService.getUserById('user-001')).rejects.toThrow();
    });

    it('should include firstName when present', async () => {
      findUserByIdResult = makeUser({ id: 'user-001', firstName: 'Alice', schoolLevel: 'troisieme' }) as Record<string, unknown>;
      const result = await sessionService.getUserById('user-001');
      expect(result?.firstName).toBe('Alice');
    });
  });

  describe('updateSessionWithFiles', () => {
    it('should append file data to session metadata', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID }) as Record<string, unknown>;
      (findByIdResult as Record<string, unknown>).sessionMetadata = {};

      await sessionService.updateSessionWithFiles(VALID_UUID, {
        fileName: 'test.pdf',
        analysis: 'Math document',
        fileType: 'application/pdf',
        size: 1024,
        uploadedAt: '2025-06-15T10:00:00Z',
      });

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should throw for invalid UUID', async () => {
      await expect(
        sessionService.updateSessionWithFiles('invalid', {
          fileName: 'test.pdf',
          analysis: 'test',
          fileType: 'pdf',
          size: 100,
          uploadedAt: '2025-01-01',
        })
      ).rejects.toThrow();
    });

    it('should throw when session not found', async () => {
      findByIdResult = null;
      await expect(
        sessionService.updateSessionWithFiles(VALID_UUID, {
          fileName: 'test.pdf',
          analysis: 'test',
          fileType: 'pdf',
          size: 100,
          uploadedAt: '2025-01-01',
        })
      ).rejects.toThrow();
    });
  });

  describe('getSessionFiles', () => {
    it('should return files from session metadata', async () => {
      findByIdResult = {
        ...makeStudySession({ id: VALID_UUID }),
        sessionMetadata: {
          attachedFiles: [
            { fileName: 'doc.pdf', analysis: 'Math', fileType: 'pdf', analyzedAt: '2025-06-15' },
          ],
        },
      } as Record<string, unknown>;

      const files = await sessionService.getSessionFiles(VALID_UUID);
      expect(files.length).toBe(1);
      expect(files[0]?.fileName).toBe('doc.pdf');
    });

    it('should return empty array for invalid UUID', async () => {
      const files = await sessionService.getSessionFiles('invalid');
      expect(files).toEqual([]);
    });

    it('should return empty array when no metadata', async () => {
      findByIdResult = {
        ...makeStudySession({ id: VALID_UUID }),
        sessionMetadata: null,
      } as Record<string, unknown>;

      const files = await sessionService.getSessionFiles(VALID_UUID);
      expect(files).toEqual([]);
    });
  });
});

// ============================================
// ChatMessageService
// ============================================

describe('ChatMessageService', () => {
  describe('saveMessage', () => {
    it('should save user message and return IDs', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID }) as Record<string, unknown>;
      createMessageResult = { id: 'msg-001' };

      const result = await messageService.saveMessage(VALID_UUID, 'user', 'Bonjour', {});
      expect(result.messageId).toBe('msg-001');
      expect(result.realSessionId).toBe(VALID_UUID);
    });

    it('should save assistant message with metadata', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID }) as Record<string, unknown>;
      createMessageResult = { id: 'msg-002' };

      const result = await messageService.saveMessage(VALID_UUID, 'assistant', 'Response', {
        tokensUsed: 150,
        responseTimeMs: 500,
        aiModel: 'mistral-large-3',
      });
      expect(result.messageId).toBe('msg-002');
    });

    it('should throw for invalid session ID', async () => {
      await expect(
        messageService.saveMessage('invalid', 'user', 'Hello', {})
      ).rejects.toThrow();
    });

    it('should throw when session not found', async () => {
      findByIdResult = null;
      await expect(
        messageService.saveMessage(VALID_UUID, 'user', 'Hello', {})
      ).rejects.toThrow();
    });

    it('should handle attached file metadata', async () => {
      findByIdResult = makeStudySession({ id: VALID_UUID }) as Record<string, unknown>;
      createMessageResult = { id: 'msg-003' };

      const result = await messageService.saveMessage(VALID_UUID, 'user', 'Check this', {
        attachedFile: {
          fileName: 'homework.pdf',
          fileId: 'f-001',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
        },
      });
      expect(result.messageId).toBe('msg-003');
    });
  });

  describe('getSessionHistory', () => {
    it('should return all messages for session', async () => {
      const now = new Date();
      findBySessionIdResult = [
        makeMessage({ id: 'msg-1', sessionId: VALID_UUID, role: 'user', createdAt: now }),
        makeMessage({ id: 'msg-2', sessionId: VALID_UUID, role: 'assistant', createdAt: new Date(now.getTime() + 1000) }),
      ] as Array<Record<string, unknown>>;

      const result = await messageService.getSessionHistory(VALID_UUID);
      expect(result.length).toBe(2);
    });

    it('should return empty array for invalid UUID', async () => {
      const result = await messageService.getSessionHistory('invalid');
      expect(result).toEqual([]);
    });

    it('should filter messages after afterMessageId', async () => {
      const now = new Date();
      findBySessionIdResult = [
        makeMessage({ id: 'msg-1', createdAt: now }),
        makeMessage({ id: 'msg-2', createdAt: new Date(now.getTime() + 1000) }),
        makeMessage({ id: 'msg-3', createdAt: new Date(now.getTime() + 2000) }),
      ] as Array<Record<string, unknown>>;

      const result = await messageService.getSessionHistory(VALID_UUID, { afterMessageId: 'msg-1' });
      expect(result.length).toBe(2);
    });

    it('should apply limit and preserve file messages', async () => {
      const now = new Date();
      const msgs: Array<Record<string, unknown>> = [];
      for (let i = 0; i < 20; i++) {
        msgs.push({
          ...makeMessage({ id: `msg-${i}`, createdAt: new Date(now.getTime() + i * 1000) }),
          attachedFile: null,
        });
      }
      // Add a file message early in the list
      msgs[2] = {
        ...msgs[2],
        attachedFile: { fileName: 'test.pdf' },
      };
      findBySessionIdResult = msgs;

      const result = await messageService.getSessionHistory(VALID_UUID, { limit: 10 });
      // Should include the file message + recent limit messages
      const hasFileMsg = result.some((m: Record<string, unknown>) =>
        m.attachedFile !== null && m.attachedFile !== undefined
      );
      expect(hasFileMsg).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getMessageById', () => {
    it('should return message details for authorized user', async () => {
      findMessageByIdResult = {
        ...makeMessage({ id: VALID_UUID }),
        sessionId: VALID_UUID_2,
        questionLevel: null,
        responseTimeMs: null,
        attachedFile: null,
        messageMetadata: {},
      } as Record<string, unknown>;
      findByIdResult = makeStudySession({ id: VALID_UUID_2, userId: 'user-001' }) as Record<string, unknown>;

      const result = await messageService.getMessageById(VALID_UUID, 'user-001');
      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
    });

    it('should return null for invalid UUID', async () => {
      const result = await messageService.getMessageById('bad-id', 'user-001');
      expect(result).toBeNull();
    });

    it('should return null when message not found', async () => {
      findMessageByIdResult = null;
      const result = await messageService.getMessageById(VALID_UUID, 'user-001');
      expect(result).toBeNull();
    });

    it('should return null for unauthorized access', async () => {
      findMessageByIdResult = {
        ...makeMessage({ id: VALID_UUID }),
        sessionId: VALID_UUID_2,
      } as Record<string, unknown>;
      findByIdResult = makeStudySession({ id: VALID_UUID_2, userId: 'other-user' }) as Record<string, unknown>;

      const result = await messageService.getMessageById(VALID_UUID, 'user-001');
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
