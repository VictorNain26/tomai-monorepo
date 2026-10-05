import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeStudySession, makeMessage } from './_helpers/fixtures';

const loggedErrors: string[] = [];
mock.module('../platform/observability/logger', () => ({
  logger: { ...createMockLogger(), error: mock((message: string) => { loggedErrors.push(message); }) },
}));

let session = makeStudySession({ userId: 'user-001' });
const updateSession = mock(async (_id: string, _values: Record<string, unknown>) => {});
mock.module('../modules/tutor/study-sessions.repository', () => ({
  studySessionsRepository: { findById: mock(async () => session), update: updateSession },
}));

const sessionMessages = Array.from({ length: 6 }, (_, i) => makeMessage({ id: `msg-${String(i)}`, content: `Échange ${String(i)}` }));
const findAfter = mock(async (_sessionId: string, afterId: string | null) =>
  (afterId ? sessionMessages.slice(sessionMessages.findIndex((m) => m.id === afterId) + 1) : sessionMessages));
mock.module('../modules/tutor/messages.repository', () => ({
  messagesRepository: { findAfter, countBySessionId: mock(async () => sessionMessages.length) },
}));

const inserted: Record<string, unknown>[] = [];
let relevant: { sessionId: string; subject: string; summaryText: string; conceptsCovered: string[]; createdAt: Date; similarity: number }[] = [];
const findRelevantEpisodes = mock(async () => relevant);
mock.module('../modules/tutor/episodic-memory.repository', () => ({
  episodicMemoryRepository: {
    insertEpisode: mock(async (data: Record<string, unknown>) => { inserted.push(data); }),
    findRelevantEpisodes,
  },
}));

mock.module('../modules/tutor/student-subject-profile.repository', () => ({
  studentSubjectProfileRepository: { upsertAggregate: mock(async () => {}) },
}));

const { episodicMemoryService } = await import('../modules/tutor/episodic-memory.service');

const originalFetch = globalThis.fetch;
let chatCalls = 0;
let chatPrompt = '';

function stubMistral(episode: Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith('/embeddings')) {
      return new Response(JSON.stringify({
        id: 'e', object: 'list', model: 'mistral-embed-2312',
        data: [{ object: 'embedding', index: 0, embedding: Array.from({ length: 1024 }, () => 0.5) }],
        usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    chatCalls += 1;
    chatPrompt = input instanceof Request ? await input.clone().text() : typeof init?.body === 'string' ? init.body : '';
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
  chatPrompt = '';
  loggedErrors.length = 0;
  session = makeStudySession({ userId: 'user-001' });
  relevant = [];
  updateSession.mockClear();
  findRelevantEpisodes.mockClear();
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

  it("reads the session's summary and only the messages it does not cover", async () => {
    session = makeStudySession({ userId: 'user-001', conversationSummary: 'Résumé : les fractions', summaryUpToMessageId: 'msg-3' });
    stubMistral({ summary: 'Travail sur les fractions.', conceptsCovered: ['fractions'], outcome: 'completed' });

    await episodicMemoryService.extractAndStore('session-001', 'user-001');

    expect(findAfter).toHaveBeenLastCalledWith('session-001', 'msg-3');
    expect(chatPrompt).toContain('Résumé : les fractions');
    expect(chatPrompt).toContain('Échange 4');
    expect(chatPrompt).not.toContain('Échange 3');
    expect(inserted[0]).toMatchObject({ messageCount: 6 });
  });

  it('logs and stores nothing when the extraction violates the schema twice', async () => {
    stubMistral({ summary: 'Travail sur les fractions.', conceptsCovered: ['fractions'], outcome: 'x' });

    await episodicMemoryService.extractAndStore('session-001', 'user-001');

    expect(chatCalls).toBe(2);
    expect(inserted).toHaveLength(0);
    expect(loggedErrors).toEqual(['Episodic extraction failed']);
  });
});

describe('episodicMemoryService.recallForSession', () => {
  const recall = (stored: string | null, content = "Résous 3x + 5 = 20, j'ai trouvé 20/3.") =>
    episodicMemoryService.recallForSession({ sessionId: 'session-001', userId: 'user-001', content, stored });

  it('reads the block the session keeps, searching nothing', async () => {
    expect(await recall('<past_sessions>gardé</past_sessions>')).toBe('<past_sessions>gardé</past_sessions>');
    expect(await recall('')).toBeNull();
    expect(findRelevantEpisodes).not.toHaveBeenCalled();
  });

  it('searches once, at the first message long enough, and keeps what it found or its absence', async () => {
    expect(await recall(null, 'Bonjour')).toBeNull();
    expect(findRelevantEpisodes).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();

    stubMistral({});
    expect(await recall(null)).toBeNull();
    expect(updateSession).toHaveBeenLastCalledWith('session-001', { recalledEpisodes: '' });

    relevant = [{ sessionId: 's0', subject: 'mathematiques', summaryText: 'Les équations', conceptsCovered: ['équations'], createdAt: new Date('2026-09-30'), similarity: 0.8 }];
    const block = await recall(null);
    expect(block).toContain('Les équations');
    expect(updateSession).toHaveBeenLastCalledWith('session-001', { recalledEpisodes: block });
  });
});
