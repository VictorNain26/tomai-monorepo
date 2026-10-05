/**
 * A chat turn whose text reaches the student only once checked (`output-check.ts`): the model's
 * stream passes through, its text held back; the text kept is written in one block before the
 * stream ends. On a failed check, one regeneration under constraint, without tools, then a fixed
 * reply.
 */

import { toUIMessageStream, type InferUIMessageChunk, type UIMessageStreamWriter } from 'ai';
import { logger } from '../../platform/observability/logger.js';
import { streamChat, type ChatStreamParams } from './ai-chat.service.js';
import type { TomChatMessage } from './chat-ui-message.js';
import { checkOutput, FALLBACK_REPLY, regenerationInstruction, type Finding, type OutputCheckContext } from './output-check.js';

type Chunk = InferUIMessageChunk<TomChatMessage>;
type StreamChatResult = ReturnType<typeof streamChat>;

export interface ControlledTurn {
  /** Every model call of the turn, for the usage. */
  results: StreamChatResult[];
  /** The call whose text the student read; null for the fixed reply, which replays as text. */
  kept: StreamChatResult | null;
  /** What the check held back from the first text; empty when it passed. */
  findings: Finding[];
  outcome: 'passed' | 'regenerated' | 'fallback';
}

/** Forwards the stream's parts but its text, and returns that text, the steps' texts apart. */
async function forwardAllButText(writer: UIMessageStreamWriter<TomChatMessage>, stream: ReadableStream<Chunk>, held: Chunk[]): Promise<string> {
  const reader = stream.getReader();
  let text = '';
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    const chunk = next.value;
    if (chunk.type === 'text-start') {
      if (text) text += '\n\n';
    } else if (chunk.type === 'text-delta') {
      text += chunk.delta;
    } else if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
      held.push(chunk);
    } else if (chunk.type !== 'text-end') {
      writer.write(chunk);
    }
  }
  return text;
}

export async function runControlledTurn(
  writer: UIMessageStreamWriter<TomChatMessage>,
  params: ChatStreamParams,
  check: OutputCheckContext,
): Promise<ControlledTurn> {
  const first = streamChat(params);
  const held: Chunk[] = [];
  const firstText = await forwardAllButText(writer, toUIMessageStream<typeof params.tools, TomChatMessage>({ stream: first.stream, tools: params.tools, sendReasoning: false }), held);
  const findings = firstText ? checkOutput(firstText, check) : [];

  let turn: ControlledTurn = { results: [first], kept: first, findings, outcome: 'passed' };
  let text = firstText;
  if (findings.length > 0) {
    const second = streamChat({
      ...params,
      tools: {},
      turnInstruction: [params.turnInstruction, regenerationInstruction(findings)].filter(Boolean).join('\n\n'),
    });
    const secondText = await Promise.resolve(second.text).catch(() => '');
    const passed = secondText !== '' && checkOutput(secondText, check).length === 0;
    text = passed ? secondText : FALLBACK_REPLY;
    turn = { results: [first, second], kept: passed ? second : null, findings, outcome: passed ? 'regenerated' : 'fallback' };
    logger.warn('Tutor message held back by the check', {
      operation: 'output-check:held',
      sessionId: params.sessionId,
      findings: findings.map((finding) => finding.kind),
      outcome: turn.outcome,
    });
  }

  if (text) {
    const id = 'checked-text';
    writer.write({ type: 'text-start', id });
    writer.write({ type: 'text-delta', id, delta: text });
    writer.write({ type: 'text-end', id });
  }
  for (const chunk of held) writer.write(chunk);
  return turn;
}
