import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

const SESSION_ID = '0199a3c4-7b1e-7d2a-9f00-123456789abc';
const MESSAGE_ID = '0199a3c4-7b1e-7d2a-9f00-123456789abd';
// What the model produced, stored to be replayed: it never goes back to the client.
const modelMessages = [{ role: 'assistant', content: [{ type: 'reasoning', text: 'La réponse est x = 5.' }, { type: 'text', text: 'Que fais-tu du +5 ?' }] }];
const assistantRow = {
  id: MESSAGE_ID,
  sessionId: SESSION_ID,
  role: 'assistant' as const,
  content: 'Que fais-tu du +5 ?',
  createdAt: new Date('2026-10-04T10:00:00Z'),
  timestamp: new Date('2026-10-04T10:00:00Z'),
  aiModel: 'mistral-small-2603',
  attachedFile: null,
  modelMessages,
  messageMetadata: { turnAnalysis: { proposesAnswer: true, asksSolution: false } },
};

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const signedIn = () => Promise.resolve({
    success: true as const,
    user: { id: 'student-1', role: 'student', firstName: 'Léa', schoolLevel: 'quatrieme' },
    session: {},
  });
  return { requireAuth: signedIn, requireParentRole: signedIn };
});
mock.module('../modules/tutor/chat-session.service', () => ({
  chatSessionService: { getSessionForUser: mock(async () => ({ id: SESSION_ID, userId: 'student-1' })) },
}));
mock.module('../modules/tutor/chat-message.service', () => ({
  chatMessageService: {
    getSessionHistory: mock(async () => [assistantRow]),
    getMessageById: mock(async () => assistantRow),
  },
}));

const { chatSessionRoutes } = await import('../modules/tutor/chat-session.routes');
const app = new Hono<AppEnv>().route('/api', chatSessionRoutes);

describe('chat read routes', () => {
  it('return what the student saw, never the reasoning nor the stored model messages', async () => {
    for (const path of [`/api/chat/session/${SESSION_ID}/history`, `/api/chat/message/${MESSAGE_ID}`]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('Que fais-tu du +5 ?');
      expect(body).not.toContain('La réponse est x = 5.');
      expect(body).not.toContain('modelMessages');
      expect(body).not.toContain('turnAnalysis');
    }
  });
});
