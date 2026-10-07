import { describe, expect, it } from 'bun:test';
import type { ModelMessage } from 'ai';
import { createModeration } from '../../../platform/ai/moderation';
import { testAi } from '../../../testing/ai';
import { writeChecked, type WriterCall } from './controlled-turn';
import { FALLBACK_REPLY, type OutputCheckContext } from './output-check';
import type { ExerciseSheet } from './sheet';

const { ai, logger, logs, mistral, sent, studentId } = await testAi();
const deps = { ai, moderation: createModeration({ mistral: mistral.config(), logger }), logger };

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.',
  kind: 'short',
  answer: 'x = 5',
  answerForms: ['5', 'x = 5'],
  mathEquation: '3*x + 5 = 20',
  mathAnswer: 'x = 5',
  steps: [],
  commonErrors: [],
  rule: null,
  facts: [],
  expectedElements: [],
  entries: [],
  laterEntries: [],
};
const check: OutputCheckContext = { sheet, uncertain: false, drawnForms: [], diagnosis: null, studentText: 'Je bloque', pastStudentTexts: [] };
const call: WriterCall = {
  studentId,
  sessionId: 'session-1',
  system: 'Tu es Tom.',
  messages: (extra): ModelMessage[] => [
    { role: 'user', content: [extra, '<student_message>\nJe bloque\n</student_message>'].filter(Boolean).join('\n\n') },
  ],
  reasoningEffort: 'none',
};

describe('writeChecked', () => {
  it('sends a text that passes as it came, the session as cache key', async () => {
    mistral.chat.push({ text: 'Que fais-tu du + 5 ?' });
    expect(await writeChecked(deps, call, check)).toEqual({
      text: 'Que fais-tu du + 5 ?',
      findings: [],
      outcome: 'passed',
      replay: [{ role: 'assistant', content: [{ type: 'text', text: 'Que fais-tu du + 5 ?' }] }],
    });
    expect(sent().body).toMatchObject({ prompt_cache_key: 'session-1', temperature: 0.7, max_tokens: 1024 });
  });

  it('writes again, told what was held back but not the text, when the first gives the answer', async () => {
    mistral.chat.push({ text: 'Donc x = 5.' }, { text: 'Que fais-tu du + 5 ?' });
    const reply = await writeChecked(deps, call, check);
    expect(reply).toMatchObject({ text: 'Que fais-tu du + 5 ?', findings: [{ kind: 'answer' }], outcome: 'regenerated' });
    expect(sent(1).user).toContain("Elle donnait la réponse de l'exercice");
    expect(sent(1).user).not.toContain('Donc x = 5.');
    expect(logs).toContainEqual(expect.objectContaining({ msg: 'Tutor message held back by the check', outcome: 'regenerated' }));
  });

  it('gives the fixed reply when the second text fails the check too', async () => {
    mistral.chat.push({ text: 'Donc x = 5.' }, { text: 'Bon, x = 5.' });
    expect(await writeChecked(deps, call, check)).toMatchObject({
      text: FALLBACK_REPLY,
      outcome: 'fallback',
      replay: [{ role: 'assistant', content: [{ type: 'text', text: FALLBACK_REPLY }] }],
    });
  });

  it('never writes again a text moderation could not check: the fixed reply goes', async () => {
    mistral.chat.push({ text: 'Que fais-tu du + 5 ?' });
    mistral.moderations.push({ status: 400 });
    expect(await writeChecked(deps, call, check)).toMatchObject({ text: FALLBACK_REPLY, findings: [{ kind: 'unmoderated' }], outcome: 'fallback' });
    expect(mistral.received.filter((r) => r.path === '/v1/chat/completions')).toHaveLength(1);
  });

  it('gives the fixed reply for an empty text', async () => {
    mistral.chat.push({ text: '  ' });
    expect(await writeChecked(deps, call, check)).toMatchObject({ text: FALLBACK_REPLY, outcome: 'fallback' });
  });
});
