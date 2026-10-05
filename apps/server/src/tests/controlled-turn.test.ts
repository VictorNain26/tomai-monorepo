import './_helpers/mistral-env';
import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { simulateReadableStream, tool, type InferUIMessageChunk, type UIMessageStreamWriter } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { runControlledTurn } from '../modules/tutor/controlled-turn';
import { FALLBACK_REPLY, type OutputCheckContext } from '../modules/tutor/output-check';
import type { TomChatMessage } from '../modules/tutor/chat-ui-message';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';

type Chunk = InferUIMessageChunk<TomChatMessage>;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

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
        { type: 'finish' as const, usage, finishReason: { unified: 'stop' as const, raw: undefined } },
      ],
    }),
  };
}

/** A model answering each call with the next of `replies`. */
function model(...replies: string[][]) {
  let call = 0;
  return new MockLanguageModelV4({ doStream: async () => textStream(...(replies[call++] ?? [''])) });
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
  it('writes a text that passes the check in one block, after the other parts and before the end', async () => {
    const out = writer();
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: model(['Que fais-tu ', 'du + 5 ?']) }, check);

    expect(turn.outcome).toBe('passed');
    expect(turn.kept).toBe(turn.results[0] ?? null);
    expect(texts(out.chunks)).toEqual(['Que fais-tu du + 5 ?']);
    const types = out.chunks.map((chunk) => chunk.type);
    expect(types.indexOf('text-start')).toBeGreaterThan(types.indexOf('start'));
    expect(types.at(-1)).toBe('finish');
    expect(types.filter((type) => type === 'text-start')).toHaveLength(1);
  });

  it('never streams the held text, regenerates under constraint without tools, and writes the regenerated text', async () => {
    const out = writer();
    const llm = model(['Bravo, x = 5.'], ['Que fais-tu du + 5 ?']);
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: llm }, check);

    expect(turn).toMatchObject({ outcome: 'regenerated', findings: [{ kind: 'answer' }] });
    expect(turn.kept).toBe(turn.results[1] ?? null);
    expect(texts(out.chunks)).toEqual(['Que fais-tu du + 5 ?']);
    const second = llm.doStreamCalls[1];
    expect(second?.tools ?? []).toEqual([]);
    const sent = JSON.stringify(second?.prompt.at(-1));
    expect(sent).toContain('<contrat>');
    expect(sent).toContain("Ta réponse précédente a été retenue par le serveur, l'élève ne l'a pas vue.");
    expect(sent).not.toContain('x = 5');
  });

  it('writes the fixed reply when the regeneration fails the check too', async () => {
    const out = writer();
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: model(['x = 5'], ['Donc x = 5']) }, check);

    expect(turn).toMatchObject({ outcome: 'fallback', kept: null });
    expect(texts(out.chunks)).toEqual([FALLBACK_REPLY]);
  });

  it('writes nothing for a turn without text', async () => {
    const out = writer();
    const turn = await runControlledTurn(out.write, { ...base, tools: noop, model: model(['']) }, check);

    expect(turn.outcome).toBe('passed');
    expect(out.chunks.some((chunk) => chunk.type === 'text-start')).toBe(false);
  });
});
