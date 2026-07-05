/**
 * Tests — ChatOrchestrationService.finishTurn (services/chat/chat-orchestration.service.ts)
 *
 * Mirrors the legacy SSE pipeline's `postProcess`, which only ever ran on a
 * `done` chunk (never on a stream that errored before producing content):
 * when the AI SDK `onFinish` callback fires with an empty `responseMessage`
 * (no text parts), nothing gets persisted and no token/cost accounting runs.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { TomChatMessage } from '../services/chat/chat-ui-message';
import type { ClassifiedIntent } from '../services/chat/intent-classifier.service';

// ============================================
// MOCKS (must be before any import of the real module under test)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../services/chat/chat-session.service', () => ({
  chatSessionService: {
    getSession: mock(async () => null),
    getOrCreateActiveSession: mock(async () => 'session-001'),
    getSessionWithSummary: mock(async () => null),
  },
}));

const saveMessage = mock(
  async (
    _sessionId: string,
    _role: 'user' | 'assistant',
    _content: string,
    _metadata?: unknown,
    _options?: unknown,
  ) => ({ messageId: 'msg-1', realSessionId: 'session-001' }),
);
mock.module('../services/chat/chat-message.service', () => ({
  chatMessageService: { saveMessage, getSessionHistory: mock(async () => []) },
}));

mock.module('../db/repositories/index', () => ({
  sessionFilesRepository: { attach: mock(async () => {}) },
  studySessionsRepository: { updateSubject: mock(async () => {}) },
}));

mock.module('../services/chat/file-context.service', () => ({
  fileContextService: {
    prepareFileContext: mock(async () => ({ attachedFileInfos: [], attachedFiles: [] })),
    prepareMultimodalFiles: mock(async () => []),
  },
}));

mock.module('../services/chat/mistral-helpers', () => ({
  getLearningContext: mock(async () => null),
}));

const summarizeIfNeeded = mock(async () => {});
mock.module('../services/chat/summarization.service', () => ({
  summarizationService: { summarizeIfNeeded },
}));

const generateTitleIfNeeded = mock(async () => {});
mock.module('../services/chat/auto-title.service', () => ({
  autoTitleService: { generateTitleIfNeeded },
}));

mock.module('../services/chat/intent-classifier.service', () => ({
  intentClassifierService: {
    classify: mock(async () => ({ intent: 'unknown', confidence: 'low', subject: 'general' })),
    buildReinforcement: mock(() => null),
  },
}));

mock.module('../services/cognitive-profile.service', () => ({
  cognitiveProfileService: { getProfileSummary: mock(async () => null) },
}));

const record = mock(async () => {});
mock.module('../services/cost-tracking.service', () => ({
  costTrackingService: { record },
}));

mock.module('../services/episodic-memory.service', () => ({
  episodicMemoryService: {
    retrieveRelevant: mock(async () => []),
    formatEpisodesForPrompt: mock(() => null),
  },
}));

mock.module('../services/chat/subject-profile.service', () => ({
  subjectProfileService: { formatSubjectMemoryForPrompt: mock(async () => null) },
}));

const incrementTokenUsage = mock(async () => {});
mock.module('../services/token-quota.service', () => ({
  tokenQuotaService: { incrementTokenUsage },
}));

// Import the real module under test AFTER all mocks are registered.
const { chatOrchestrationService } = await import('../services/chat/chat-orchestration.service');

describe('ChatOrchestrationService.finishTurn', () => {
  beforeEach(() => {
    saveMessage.mockClear();
    incrementTokenUsage.mockClear();
    record.mockClear();
    summarizeIfNeeded.mockClear();
    generateTitleIfNeeded.mockClear();
  });

  const noopIntent: ClassifiedIntent = { intent: 'unknown', confidence: 'low', subject: 'general' };

  it('skips persistence entirely when the stream produced no content', async () => {
    const emptyResponse: TomChatMessage = { id: 'm2', role: 'assistant', parts: [] };
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      responseMessage: emptyResponse,
      model: 'mistral-medium-latest',
      usage: undefined,
      startTime: Date.now(),
      attachedFileInfo: null,
      classifiedIntent: noopIntent,
    });

    expect(saveMessage).not.toHaveBeenCalled();
    expect(incrementTokenUsage).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(summarizeIfNeeded).not.toHaveBeenCalled();
    expect(generateTitleIfNeeded).not.toHaveBeenCalled();
  });

  it('persists the assistant message and accounts tokens when content was produced', async () => {
    const filledResponse: TomChatMessage = {
      id: 'm2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Bonjour à toi', state: 'done' }],
    };
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      responseMessage: filledResponse,
      model: 'mistral-medium-latest',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokenDetails: { textTokens: 5, reasoningTokens: 0 },
      },
      startTime: Date.now(),
      attachedFileInfo: null,
      classifiedIntent: noopIntent,
    });

    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(saveMessage.mock.calls[0]?.[1]).toBe('assistant');
    expect(saveMessage.mock.calls[0]?.[2]).toBe('Bonjour à toi');
    expect(incrementTokenUsage).toHaveBeenCalledWith('user-001', 15);
    expect(record).toHaveBeenCalledTimes(1);
    expect(summarizeIfNeeded).toHaveBeenCalledWith('session-001');
    expect(generateTitleIfNeeded).toHaveBeenCalledWith('session-001', 'Bonjour', 'Bonjour à toi');
  });
});
