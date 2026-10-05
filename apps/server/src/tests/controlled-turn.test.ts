import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { z } from 'zod';
import { simulateReadableStream, tool, type InferUIMessageChunk, type UIMessageStreamWriter } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { OutputCheckContext } from '../modules/tutor/output-check';
import type { TomChatMessage } from '../modules/tutor/chat-ui-message';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';

// Moderation is a network call: stubbed, with what each test needs.
/** What moderation answers, one per call, in order; past the end, nothing flagged. */
let moderationReplies: (string[] | Error)[] = [];
mock.module('../platform/ai/moderation', () => ({
  moderateReply: mock(async () => {
    const reply = moderationReplies.shift() ?? [];
    if (reply instanceof Error) throw reply;
    return reply;
  }),
  moderateTexts: mock(async (texts: string[]) => texts.map(() => [])),
}));

const { runControlledTurn } = await import('../modules/tutor/controlled-turn');
const { FALLBACK_REPLY } = await import('../modules/tutor/output-check');


type Chunk = InferUIMessageChunk<TomChatMessage>;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const finish = (unified: 'stop' | 'tool-calls') => ({ type: 'finish' as const, usage, finishReason: { unified, raw: undefined } });

function textStream(...texts: string[]) {
  return {
    stream: simulateReadableStream({
      chunkDelayInMs: 0,
      initialDelayInMs: 0,
      chunks: [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 't' },
        ...texts.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
        { type: 'text-end' as const, id: 't' },
        finish('stop'),
      ],
    }),
  };
}

/** A step that writes a text, then calls the noop tool. */
function textThenTool(text: string) {
  return {
    stream: simulateReadableStream({
      chunkDelayInMs: 0,
      initialDelayInMs: 0,
      chunks: [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 'a' },
        { type: 'text-delta' as const, id: 'a', delta: text },
        { type: 'text-end' as const, id: 'a' },
        { type: 'tool-call' as const, toolCallId: 'c1', toolName: 'noop_tool', input: '{}' },
        finish('tool-calls'),
      ],
    }),
  };
}

/** A step cut after writing a text. */
function textThenError(text: string) {
  return {
    stream: simulateReadableStream({
      chunkDelayInMs: 0,
      initialDelayInMs: 0,
      chunks: [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 'a' },
        { type: 'text-delta' as const, id: 'a', delta: text },
        { type: 'error' as const, error: new Error('timeout') },
      ],
    }),
  };
}

type Reply = string[] | (() => ReturnType<typeof textStream> | ReturnType<typeof textThenTool> | ReturnType<typeof textThenError>);

/** A model answering each call with the next of `replies`. */
function model(...replies: Reply[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const reply = replies[call++] ?? [''];
      return typeof reply === 'function' ? reply() : textStream(...reply);
    },
  });
}

function writer() {
  const chunks: Chunk[] = [];
  const write: UIMessageStreamWriter<TomChatMessage> = { write: (chunk) => { chunks.push(chunk); }, merge: () => {}, onError: undefined };
  return { chunks, write };
}

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.', kind: 'short', answer: 'x = 5', answerForms: ['x = 5'], mathEquation: null, mathAnswer: null,
  steps: [], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
};
const check: OutputCheckContext = { sheet, uncertain: false, diagnosis: null, studentText: 'Je bloque', pastStudentTexts: [] };
const base = { userId: 'u1', sessionId: 's1', content: 'Je bloque', schoolLevel: 'quatrieme' as const, conversationHistory: [], turnInstruction: '<contrat>\nPalier 1\n</contrat>' };
const noop = { noop_tool: tool({ description: 'noop', inputSchema: z.object({}), execute: async () => 'ok' }) };

const texts = (chunks: Chunk[]) => chunks.flatMap((chunk) => (chunk.type === 'text-delta' ? [chunk.delta] : []));

describe('runControlledTurn', () => {
  beforeEach(() => { moderationReplies = []; });

  it('writes a text that passes the check in one block, after the other parts and before the end', async () => {
    const out = writer();
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: model(['Que fais-tu ', 'du + 5 ?']) }, check);

    expect(turn).toMatchObject({ outcome: 'passed', text: 'Que fais-tu du + 5 ?' });
    expect(texts(out.chunks).join('')).toBe('Que fais-tu du + 5 ?');
    expect(out.chunks.map((chunk) => chunk.type).at(-1)).toBe('finish');
    expect(await turn.replay()).toMatchObject([{ role: 'assistant', content: [{ type: 'text', text: 'Que fais-tu du + 5 ?' }] }]);
  });

  it('sends a text that passes as it came, its parts in their order: the text announcing a tool before the tool', async () => {
    const out = writer();
    await runControlledTurn(out.write, { ...base, tools: noop, model: model(() => textThenTool('Je regarde.'), ['Voilà.']) }, check);

    const types = out.chunks.map((chunk) => chunk.type);
    expect(types.indexOf('text-delta')).toBeLessThan(types.indexOf('tool-input-available'));
    expect(texts(out.chunks)).toEqual(['Je regarde.', 'Voilà.']);
  });

  it('never streams the held text, regenerates under constraint without tools, and writes the regenerated text', async () => {
    const out = writer();
    const llm = model(['Bravo, x = 5.'], ['Que fais-tu du + 5 ?']);
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: llm }, check);

    expect(turn).toMatchObject({ outcome: 'regenerated', findings: [{ kind: 'answer' }], text: 'Que fais-tu du + 5 ?' });
    expect(turn.results).toHaveLength(2);
    expect(texts(out.chunks)).toEqual(['Que fais-tu du + 5 ?']);
    expect(await turn.replay()).toEqual([{ role: 'assistant', content: [{ type: 'text', text: 'Que fais-tu du + 5 ?' }] }]);
    const second = llm.doStreamCalls[1];
    expect(second?.tools ?? []).toEqual([]);
    const sent = JSON.stringify(second?.prompt.at(-1));
    expect(sent).toContain('<contrat>');
    expect(sent).toContain("Une première réponse à ce tour a été retenue par le serveur, l'élève ne l'a pas vue.");
    expect(sent).not.toContain('x = 5');
  });

  it('writes the fixed reply when the regeneration fails the check too', async () => {
    const out = writer();
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: model(['x = 5'], ['Donc x = 5']) }, check);

    expect(turn).toMatchObject({ outcome: 'fallback', text: FALLBACK_REPLY });
    expect(texts(out.chunks)).toEqual([FALLBACK_REPLY]);
  });

  it('does not regenerate after a tool call, whose effect stays: the fixed reply, the tool call kept in the replay', async () => {
    const out = writer();
    const llm = model(() => textThenTool('x = 5, et voici tes cartes.'), ['Voilà tes cartes.']);
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: llm }, check);

    expect(turn).toMatchObject({ outcome: 'fallback', text: FALLBACK_REPLY });
    expect(llm.doStreamCalls).toHaveLength(2);
    expect(out.chunks.some((chunk) => chunk.type === 'tool-input-available')).toBe(true);
    expect(texts(out.chunks)).toEqual([FALLBACK_REPLY]);
    const replay = await turn.replay();
    expect(replay?.map((message) => message.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(JSON.stringify(replay)).not.toContain('x = 5');
    expect(replay?.at(-1)).toEqual({ role: 'assistant', content: [{ type: 'text', text: FALLBACK_REPLY }] });
  });

  it('does not regenerate a cut turn: the fixed reply, then the error', async () => {
    const out = writer();
    const llm = model(() => textThenError('Donc x = 5'), ['Voilà.']);
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: llm }, check);

    expect(turn).toMatchObject({ outcome: 'fallback', text: FALLBACK_REPLY });
    expect(turn.results).toHaveLength(1);
    expect(texts(out.chunks)).toEqual([FALLBACK_REPLY]);
    const types = out.chunks.map((chunk) => chunk.type);
    expect(types.indexOf('error')).toBeGreaterThan(types.indexOf('text-delta'));
  });

  it('regenerates a text moderation holds back, and keeps what was held', async () => {
    moderationReplies = [['violence_and_threats'], []];
    const out = writer();
    const llm = model(['Texte retenu.'], ['Que fais-tu du + 5 ?']);
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: llm }, check);

    expect(turn).toMatchObject({ outcome: 'regenerated', text: 'Que fais-tu du + 5 ?', findings: [{ kind: 'moderation', categories: ['violence_and_threats'] }] });
    expect(texts(out.chunks)).toEqual(['Que fais-tu du + 5 ?']);
    expect(JSON.stringify(llm.doStreamCalls[1]?.prompt.at(-1))).toContain('retenue par la modération');
  });

  it('sends the fixed reply without regenerating when moderation cannot answer: nothing reaches the student unchecked', async () => {
    moderationReplies = [new Error('moderation down')];
    const out = writer();
    const llm = model(['Que fais-tu du + 5 ?'], ['Autre.']);
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: llm }, check);

    expect(turn).toMatchObject({ outcome: 'fallback', findings: [{ kind: 'unmoderated' }], text: FALLBACK_REPLY });
    expect(llm.doStreamCalls).toHaveLength(1);
  });

  it('writes nothing for a turn without text', async () => {
    const out = writer();
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: model(['']) }, check);

    expect(turn).toMatchObject({ outcome: 'passed', text: '' });
    expect(texts(out.chunks).join('')).toBe('');
  });
});
