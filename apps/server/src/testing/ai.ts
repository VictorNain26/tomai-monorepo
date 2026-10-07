/**
 * The AI client of a test: the real one, against the fake Mistral, billing a real student on this
 * file's database. `logs` keeps what the steps log at warn and above.
 */

import { beforeEach } from 'bun:test';
import pino from 'pino';
import { createAi } from '../platform/ai/client';
import { user } from '../platform/auth/schema';
import { testDatabase } from './database';
import { fakeMistral } from './mistral';

export async function testAi() {
  const { db } = await testDatabase();
  const mistral = fakeMistral();
  const logs: Record<string, unknown>[] = [];
  const logger = pino({ level: 'warn' }, { write: (line: string) => logs.push(JSON.parse(line) as Record<string, unknown>) });
  const studentId = 'student-1';
  await db.insert(user).values({ id: studentId, name: 'Léa', email: 'lea@tom.example' });

  beforeEach(() => {
    mistral.chat.length = 0;
    mistral.moderations.length = 0;
    mistral.received.length = 0;
    logs.length = 0;
  });

  /** What the user message of the n-th chat call said. */
  const sent = (index = 0) => {
    const body = mistral.received.filter((r) => r.path === '/v1/chat/completions')[index]?.body;
    const messages = (body?.['messages'] ?? []) as { role: string; content: string | { text: string }[] }[];
    const text = (content: string | { text: string }[] | undefined) =>
      typeof content === 'string' ? content : (content ?? []).map((part) => part.text).join('');
    return { system: text(messages.find((m) => m.role === 'system')?.content), user: text(messages.at(-1)?.content), body };
  };

  return { db, mistral, logs, logger, studentId, ai: createAi({ mistral: mistral.config(), db, logger }), sent };
}
