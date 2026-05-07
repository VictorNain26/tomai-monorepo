/**
 * Tests unitaires — Summarization Service (Mistral aux model).
 * Mock : DB repos + Mistral SDK + logger.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeStudySession, makeMessage } from './_helpers/fixtures';

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
    countBySessionId: mock(async () => messagesResult.length),
  },
}));

// Mistral SDK mock — captured by the service via getMistralClient → @mistralai/mistralai.
let mistralResponse: string | null = 'Mocked summary text';

mock.module('@mistralai/mistralai', () => ({
  Mistral: class {
    chat = {
      complete: mock(async () => ({
        choices: [{ message: { role: 'assistant', content: mistralResponse } }],
      })),
    };
  },
}));

mock.module('../config/app.config', () => ({
  appConfig: {
    ai: {
      mistral: {
        apiKey: 'test-key',
        chatModel: 'mistral-small-latest',
        auxModel: 'mistral-small-latest',
      },
    },
  },
}));

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
  mistralResponse = 'Mocked summary text';
});

describe('Summarization Service', () => {
  describe('summarizeIfNeeded', () => {
    it('does nothing when session not found', async () => {
      sessionResult = null;
      await summarizationService.summarizeIfNeeded('session-missing');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('does nothing with < 20 messages', async () => {
      sessionResult = makeStudySession();
      messagesResult = makeMessages(15);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('generates the first summary at 20+ messages', async () => {
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
      expect(sessionUpdateArgs.conversationSummary).toBe('Mocked summary text');
      expect(sessionUpdateArgs.summaryUpToMessageId).toBeDefined();
    });

    it('generates an incremental summary when 10+ new messages arrive', async () => {
      const messages = makeMessages(35);
      sessionResult = makeStudySession({
        conversationSummary: 'Previous summary',
        summaryUpToMessageId: messages[19]?.id ?? null,
      });
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
    });

    it('does NOT re-summarize with < 10 new messages', async () => {
      const messages = makeMessages(25);
      sessionResult = makeStudySession({
        conversationSummary: 'Previous summary',
        summaryUpToMessageId: messages[19]?.id ?? null,
      });
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('truncates summaries exceeding 6000 chars', async () => {
      mistralResponse = 'x'.repeat(7000);
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(true);
      const summary = sessionUpdateArgs.conversationSummary as string;
      expect(summary.length).toBeLessThanOrEqual(6000);
    });

    it('handles null Mistral response without throwing', async () => {
      mistralResponse = null;
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      messagesResult = makeMessages(25);
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateCalled).toBe(false);
    });

    it('keeps the last 10 messages verbatim (not summarized)', async () => {
      sessionResult = makeStudySession({ conversationSummary: null, summaryUpToMessageId: null });
      const messages = makeMessages(25);
      messagesResult = messages;
      await summarizationService.summarizeIfNeeded('session-001');
      expect(sessionUpdateArgs.summaryUpToMessageId).toBe(messages[14]?.id);
    });
  });
});
