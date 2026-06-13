/**
 * Vérifie que generateStreamChunks accumule l'usage de chaque itération
 * de la boucle agentique (tool_call → fin). Un seul mock de chatStream.
 */
import './_helpers/mistral-env';
import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { ChatStreamChunk as ClientChunk } from '../lib/ai/mistral-client';
import type { ChatStreamChunk as ServiceChunk } from '../services/chat/chat-streaming-types';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Iteration 1 : un tool_call + usage. Iteration 2 : texte final + usage.
let call = 0;
function makeStream(): AsyncIterable<ClientChunk> {
  call++;
  const iteration = call;
  return {
    async *[Symbol.asyncIterator]() {
      if (iteration === 1) {
        yield { type: 'tool_call', toolCall: { id: 'tc_1', name: 'search_educational_content', arguments: '{}' } };
        yield { type: 'done', usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } };
      } else {
        yield { type: 'text', text: 'Bonjour' };
        yield { type: 'done', usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 } };
      }
    },
  };
}

mock.module('../lib/ai/mistral-client', () => ({
  chatStream: mock(() => makeStream()),
}));

mock.module('../services/chat/tool-executor', () => ({
  executeTool: mock(() => Promise.resolve({ ok: true })),
  isDeckCreatedResult: mock(() => false),
}));

// mistral-helpers imports db/connection + drizzle-orm — mock the transitive deps.
mock.module('../db/connection', () => ({
  db: { execute: mock(() => Promise.resolve([])) },
}));
mock.module('../db/schema', () => ({
  learningCards: {},
  learningDecks: {},
}));
mock.module('drizzle-orm', () => ({
  sql: (s: unknown) => s,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  relations: () => ({}),
}));

const { mistralChatService } = await import('../services/chat/mistral-chat.service');

const BASE_PARAMS = {
  userId: 'u1',
  sessionId: 's1',
  content: 'Aide-moi',
  schoolLevel: 'quatrieme' as const,
  userRole: 'student' as const,
  conversationHistory: [],
};

async function collect() {
  const chunks: ServiceChunk[] = [];
  for await (const c of mistralChatService.generateStreamChunks(BASE_PARAMS)) {
    chunks.push(c);
  }
  return chunks;
}

describe('generateStreamChunks usage accumulation', () => {
  it('sums usage across both agentic iterations', async () => {
    call = 0;
    const chunks = await collect();
    const done = chunks.find((c) => c.type === 'done');
    expect(done).toBeDefined();
    expect(done?.usage).toEqual({ promptTokens: 150, completionTokens: 30, totalTokens: 180 });
  });

  it('marks usedRAG true when search_educational_content was called', async () => {
    call = 0;
    const chunks = await collect();
    const done = chunks.find((c) => c.type === 'done');
    expect(done?.metadata?.usedRAG).toBe(true);
  });
});
