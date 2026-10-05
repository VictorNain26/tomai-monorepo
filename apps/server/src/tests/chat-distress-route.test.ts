/**
 * Tests — the distress turn of the chat route (modules/tutor/chat-message.routes.ts): the fixed
 * reply streamed, stored with the event, and never the model.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import type { AppEnv } from '../platform/http/context';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/config/env', () => ({ env: { MISTRAL_MODEL: 'mistral-small-2603' } }));
const student = { id: 'user-001', role: 'student', schoolLevel: 'quatrieme', firstName: 'Léo' };
const resolveUser = () => Promise.resolve({ success: true as const, user: student, session: { id: 'sess-001' } });
mock.module('../platform/auth/session', () => ({ requireAuth: resolveUser, requireParentRole: resolveUser }));
mock.module('../platform/http/rate-limit', () => ({
  createRateLimitMiddleware: () => (_c: unknown, next: () => Promise<void>) => next(),
  RateLimitPresets: { ai: {} },
}));
mock.module('../modules/billing/index', () => ({ checkQuota: mock(async () => ({ allowed: true, plan: 'free' })) }));

class ChatOrchestrationError extends Error {}
const persistUserTurn = mock(async () => {});
const finishTurn = mock(async () => {});
mock.module('../modules/tutor/chat-orchestration.service', () => ({
  chatOrchestrationService: {
    prepareTurn: mock(async () => ({ kind: 'distress', sessionId: 'session-001', source: 'rules', selfharmScore: 0.01 })),
    persistUserTurn,
    finishTurn,
  },
  ChatOrchestrationError,
}));
const answerDistress = mock(async (_params: unknown) => {});
mock.module('../modules/tutor/distress.service', () => ({ answerDistress }));
mock.module('../modules/tutor/chat-tools', () => ({ buildChatTools: mock(() => ({})) }));
const streamChat = mock(() => { throw new Error('the model must not be called'); });
mock.module('../modules/tutor/ai-chat.service', () => ({ streamChat }));

const { chatMessageRoutes } = await import('../modules/tutor/chat-message.routes');
const { DISTRESS_REPLY } = await import('../modules/tutor/distress');

const app = new Hono<AppEnv>().route('/api/chat', chatMessageRoutes);

describe('POST /api/chat/stream — distress', () => {
  it('streams the fixed reply, stores the turn with the event, and calls no model', async () => {
    const res = await app.fetch(new Request('http://localhost/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'je me fais du mal quand je rate' }] } }),
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    const delta = (await res.text()).split('\n')
      .filter((line) => line.startsWith('data: {'))
      .map((line) => JSON.parse(line.slice(6)) as { type: string; delta?: string })
      .find((part) => part.type === 'text-delta');
    expect(delta?.delta).toBe(DISTRESS_REPLY);
    expect(answerDistress).toHaveBeenCalledWith({
      turn: { kind: 'distress', sessionId: 'session-001', source: 'rules', selfharmScore: 0.01 },
      userId: 'user-001',
      content: 'je me fais du mal quand je rate',
      inputMode: undefined,
    });
    expect(streamChat).not.toHaveBeenCalled();
    expect(persistUserTurn).not.toHaveBeenCalled();
    expect(finishTurn).not.toHaveBeenCalled();
  });
});
