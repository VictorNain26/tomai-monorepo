import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeStudySession, makeMessage } from './_helpers/fixtures';

const loggedErrors: string[] = [];
mock.module('../lib/observability', () => ({
  logger: { ...createMockLogger(), error: mock((message: string) => { loggedErrors.push(message); }) },
}));

mock.module('../db/repositories/study-sessions.repository', () => ({
  studySessionsRepository: { findById: mock(async () => makeStudySession({ userId: 'user-001' })) },
}));

mock.module('../db/repositories/messages.repository', () => ({
  messagesRepository: {
    findBySessionId: mock(async () => Array.from({ length: 6 }, (_, i) => makeMessage({ id: `msg-${i}` }))),
  },
}));

const inserted: Array<Record<string, unknown>> = [];
mock.module('../db/repositories/episodic-memory.repository', () => ({
  episodicMemoryRepository: {
    insertEpisode: mock(async (data: Record<string, unknown>) => { inserted.push(data); }),
    findRelevantEpisodes: mock(async () => []),
  },
}));

mock.module('../db/repositories/student-subject-profile.repository', () => ({
  studentSubjectProfileRepository: { upsertAggregate: mock(async () => {}) },
}));

const { episodicMemoryService } = await import('../services/episodic-memory.service');

const originalFetch = globalThis.fetch;
let chatCalls = 0;

function stubMistral(episode: Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith('/embeddings')) {
      return new Response(JSON.stringify({
        id: 'e', object: 'list', model: 'mistral-embed-2312',
        data: [{ object: 'embedding', index: 0, embedding: Array.from({ length: 1024 }, () => 0.5) }],
        usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    chatCalls += 1;
    return new Response(JSON.stringify({
      id: 'c', object: 'chat.completion', created: 0, model: 'mistral-small-2603',
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(episode) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  inserted.length = 0;
  chatCalls = 0;
  loggedErrors.length = 0;
});
afterEach(() => { globalThis.fetch = originalFetch; });

describe('episodicMemoryService.extractAndStore', () => {
  it('stores a valid extraction with its embedding', async () => {
    stubMistral({ summary: 'Travail sur les fractions.', conceptsCovered: ['fractions'], outcome: 'completed' });

    await episodicMemoryService.extractAndStore('session-001', 'user-001');

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      userId: 'user-001',
      sessionId: 'session-001',
      summaryText: 'Travail sur les fractions.',
      conceptsCovered: ['fractions'],
      outcome: 'completed',
      messageCount: 6,
    });
    expect((inserted[0]?.['summaryEmbedding'] as number[]).length).toBe(1024);
  });

  it('logs and stores nothing when the extraction violates the schema twice', async () => {
    stubMistral({ summary: 'Travail sur les fractions.', conceptsCovered: ['fractions'], outcome: 'x' });

    await episodicMemoryService.extractAndStore('session-001', 'user-001');

    expect(chatCalls).toBe(2);
    expect(inserted).toHaveLength(0);
    expect(loggedErrors).toEqual(['Episodic extraction failed']);
  });
});
