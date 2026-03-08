/**
 * Tests unitaires - Summarization Service (services/chat/summarization.service.ts)
 * Mock: DB repos + Gemini + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeStudySession, makeMessage } from './_helpers/fixtures';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Session repository mock
let sessionResult: Record<string, unknown> | null = null;
let sessionUpdateCalled = false;
let sessionUpdateArgs: Record<string, unknown> = {};

mock.module('../db/repositories/study-sessions.repository', () => ({
  studySessionsRepository: {
    findById: mock(async () => sessionResult),
    update: mock(async (_id: string, data: Record<string, unknown>) => {
      sessionUpdateCalled = true;
      sessionUpdateArgs = data;
    }),
  },
}));

// Messages repository mock
let messagesResult: Array<Record<string, unknown>> = [];

mock.module('../db/repositories/messages.repository', () => ({
  messagesRepository: {
    findBySessionId: mock(async () => messagesResult),
  },
}));

// Gemini mock
let geminiResponse = 'Mocked summary text';

mock.module('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mock(async () => ({
        text: geminiResponse,
      })),
    };
  },
}));

// App config mock
mock.module('../config/app.config', () => ({
  appConfig: {
    ai: {
      gemini: {
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      },
    },
  },
}));

// Import after mocks
const { summarizationService } = await import('../services/chat/summarization.service');

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
  geminiResponse = 'Mocked summary text';
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
      expect(sessionUpdateArgs.conversationSummary).toBe('Mocked summary text');
      expect(sessionUpdateArgs.summaryUpToMessageId).toBeDefined();
    });

    it('should generate incremental summary when 10+ new messages', async () => {
      const messages = makeMessages(35);
      sessionResult = makeStudySession({
        conversationSummary: 'Previous summary',
        summaryUpToMessageId: messages[19]?.id ?? null, // Summary covers first 20
      });
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
    });

    it('should NOT re-summarize with < 10 new messages', async () => {
      const messages = makeMessages(25);
      sessionResult = makeStudySession({
        conversationSummary: 'Previous summary',
        summaryUpToMessageId: messages[19]?.id ?? null, // Summary covers first 20
      });
      messagesResult = messages; // Only 4 new messages (25 - 20 - 1)
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('should truncate summary exceeding 6000 chars', async () => {
      geminiResponse = 'x'.repeat(7000);
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
      const summary = sessionUpdateArgs.conversationSummary as string;
      expect(summary.length).toBeLessThanOrEqual(6000);
    });

    it('should handle null Gemini response without throwing', async () => {
      geminiResponse = null as unknown as string;
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      // Should not throw — null response means no summary generated
      await summarizationService.summarizeIfNeeded('session-001');
      // No summary stored when Gemini returns null
      expect(sessionUpdateCalled).toBe(false);
    });

    it('should keep last 10 messages verbatim (not summarized)', async () => {
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      const messages = makeMessages(25);
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      // The summaryUpToMessageId should be message at index length-10-1 = 14
      expect(sessionUpdateArgs.summaryUpToMessageId).toBe(messages[14]?.id);
    });
  });
});
