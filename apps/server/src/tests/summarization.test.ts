/**
 * Tests unitaires - Summarization Service (modules/tutor/summarization.service.ts)
 * Mock: DB repos + Mistral + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { APICallError } from 'ai';
import { createMockLogger } from './_helpers/mock-logger';
import { makeStudySession, makeMessage } from './_helpers/fixtures';

// ============================================
// TYPES
// ============================================

interface StudySessionData {
  id: string;
  userId: string;
  subject: string;
  schoolLevel: string;
  startedAt: Date;
  endedAt: Date | null;
  conversationSummary: string | null;
  summaryUpToMessageId: string | null;
  messageCount: number;
}

interface MessageData {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  frustrationLevel: number | null;
  aiModel: string | null;
  tokensUsed: number | null;
  createdAt: Date;
}

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// Session repository mock
let sessionResult: StudySessionData | null = null;
let sessionUpdateCalled = false;
let sessionUpdateArgs: Record<string, unknown> = {};
// The cutoff in the database when the run writes; another run may have moved it meanwhile.
let movedCutoff: string | null | undefined;
const storedCutoff = () => (movedCutoff === undefined ? (sessionResult?.summaryUpToMessageId ?? null) : movedCutoff);

mock.module('../modules/tutor/study-sessions.repository', () => ({
  studySessionsRepository: {
    findById: mock(async () => sessionResult),
    replaceSummary: mock(async (_id: string, readCutoff: string | null, data: Record<string, unknown>) => {
      if (readCutoff !== storedCutoff()) return false;
      sessionUpdateCalled = true;
      sessionUpdateArgs = data;
      return true;
    }),
  },
}));

// Messages repository mock
let messagesResult: MessageData[] = [];
const afterOf = (afterId: string | null) => (afterId ? messagesResult.slice(messagesResult.findIndex((m) => m.id === afterId) + 1) : messagesResult);
const findAfter = mock(async (_sessionId: string, afterId: string | null) => afterOf(afterId));

mock.module('../modules/tutor/messages.repository', () => ({
  messagesRepository: {
    findAfter,
    countAfter: mock(async (_sessionId: string, afterId: string | null) => afterOf(afterId).length),
  },
}));

// Mistral client mock — service migré vers platform/ai/mistral-client.
// generateText retourne directement le contenu string.
let mistralResponse: string | Error = 'Mocked summary text';
let generateTextCalls = 0;
let sentToModel = '';

// Mock complet du wrapper Mistral pour isolation Bun (autres tests peuvent
// partager le même module-mock cache).
mock.module('../platform/ai/mistral-client', () => ({
  generateText: mock(async (opts: { messages: { content: string }[] }) => {
    generateTextCalls += 1;
    sentToModel = opts.messages.map((m) => m.content).join('\n');
    if (mistralResponse instanceof Error) throw mistralResponse;
    return mistralResponse;
  }),
  generateStructured: mock(async () => ({})),
}));

// Env config mock — config Mistral nécessaire au chargement du client
mock.module('../platform/config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_MODEL: 'mistral-small-2603',
    MISTRAL_TEMPERATURE: 0.7,
    MISTRAL_MAX_TOKENS: 16384,
    MISTRAL_TIMEOUT: 60000,
    MISTRAL_RETRY_ATTEMPTS: 3,
    NODE_ENV: 'test',
  },
}));

// Import after mocks
const { summarizationService } = await import('../modules/tutor/summarization.service');

function makeMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...makeMessage({
      id: `msg-${String(i + 1).padStart(3, '0')}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1} content`,
    }),
  }));
}

beforeEach(() => {
  sessionResult = null;
  messagesResult = [];
  sessionUpdateCalled = false;
  sessionUpdateArgs = {};
  movedCutoff = undefined;
  mistralResponse = 'Mocked summary text';
  generateTextCalls = 0;
  sentToModel = '';
  findAfter.mockClear();
});

describe('Summarization Service', () => {
  describe('summarizeIfNeeded', () => {
    it('should do nothing when session not found', async () => {
      sessionResult = null;
      await summarizationService.summarizeIfNeeded('session-missing');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('should do nothing with < 20 messages', async () => {
      sessionResult = makeStudySession();
      messagesResult = makeMessages(15);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('should generate first summary at 20+ messages', async () => {
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
      expect(sessionUpdateArgs['conversationSummary']).toBe('Mocked summary text');
      expect(sessionUpdateArgs['summaryUpToMessageId']).toBeDefined();
    });

    it('sends the previous summary and only the messages it does not cover, past the 10 kept verbatim', async () => {
      const messages = makeMessages(45);
      sessionResult = makeStudySession({
        conversationSummary: 'Previous summary',
        summaryUpToMessageId: messages[19]?.id ?? null, // Summary covers first 20
      });
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateArgs['summaryUpToMessageId']).toBe(messages[34]?.id);
      expect(sentToModel).toContain('Previous summary');
      expect(sentToModel).toContain('Message 21 content');
      expect(sentToModel).toContain('Message 35 content');
      expect(sentToModel).not.toContain('Message 20 content');
      expect(sentToModel).not.toContain('Message 36 content');
      expect(sentToModel).not.toContain('{previousSummary}');
    });

    it('summarizes as soon as a whole batch is past the window: 20 after the summary', async () => {
      const messages = makeMessages(40);
      sessionResult = makeStudySession({ conversationSummary: 'Previous summary', summaryUpToMessageId: messages[19]?.id ?? null });
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateArgs['summaryUpToMessageId']).toBe(messages[29]?.id);
    });

    it('writes nothing when another run moved the summary meanwhile', async () => {
      const messages = makeMessages(45);
      sessionResult = makeStudySession({ conversationSummary: 'Previous summary', summaryUpToMessageId: messages[19]?.id ?? null });
      messagesResult = messages;
      movedCutoff = messages[29]?.id ?? null;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('waits for a whole batch beyond the window, counted without loading the session', async () => {
      const messages = makeMessages(39);
      sessionResult = makeStudySession({ conversationSummary: 'Previous summary', summaryUpToMessageId: messages[19]?.id ?? null });
      messagesResult = messages; // 19 after the summary: 10 kept verbatim, 9 pending
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
      expect(findAfter).not.toHaveBeenCalled();
    });

    it('does not summarize again with 5 messages after the summary, inside the window', async () => {
      const messages = makeMessages(25);
      sessionResult = makeStudySession({
        conversationSummary: 'Previous summary',
        summaryUpToMessageId: messages[19]?.id ?? null, // Summary covers first 20
      });
      messagesResult = messages; // 5 after the summary
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('should truncate summary exceeding 6000 chars', async () => {
      mistralResponse = 'x'.repeat(7000);
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
      const summary = sessionUpdateArgs['conversationSummary'] as string;
      expect(summary.length).toBeLessThanOrEqual(6000);
    });

    it('should handle null Gemini response without throwing', async () => {
      mistralResponse = null as unknown as string;
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      // Should not throw — null response means no summary generated
      await summarizationService.summarizeIfNeeded('session-001');
      // No summary stored when Gemini returns null
      expect(sessionUpdateCalled).toBe(false);
    });

    it('calls generateText once on a non-retryable 400 (no retry loop over the SDK)', async () => {
      mistralResponse = new APICallError({
        message: 'Bad Request',
        url: 'https://api.eu.mistral.ai/v1/chat/completions',
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
      });
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);

      await summarizationService.summarizeIfNeeded('session-001');

      expect(generateTextCalls).toBe(1);
      expect(sessionUpdateCalled).toBe(false);
    });

    it('should keep last 10 messages verbatim (not summarized)', async () => {
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      const messages = makeMessages(25);
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      // The summaryUpToMessageId should be message at index length-10-1 = 14
      expect(sessionUpdateArgs['summaryUpToMessageId']).toBe(messages[14]?.id);
    });
  });
});
