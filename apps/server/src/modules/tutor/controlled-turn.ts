/**
 * A chat turn whose text reaches the student only once checked (`output-check.ts`), moderation
 * included. The model's stream is held whole; a text that passes is sent as it came, parts in
 * their order. On a failed check, one regeneration under constraint, without tools, then a fixed
 * reply; the parts that are not text are sent as they came, the text kept in one block before
 * the end.
 */

import { toUIMessageStream, type InferUIMessageChunk, type UIMessageStreamWriter } from 'ai';
import { logger } from '../../platform/observability/logger.js';
import { streamChat, type ChatStreamParams } from './ai-chat.service.js';
import type { ResponseMessage } from './chat-message-assembler.js';
import type { TomChatMessage } from './chat-ui-message.js';
import { checkReply, FALLBACK_REPLY, regenerationInstruction, type Finding, type OutputCheckContext } from './output-check.js';

type Chunk = InferUIMessageChunk<TomChatMessage>;
type StreamChatResult = ReturnType<typeof streamChat>;

export interface ControlledTurn {
  /** Every model call of the turn, for the usage. */
  results: StreamChatResult[];
  /** The text the student read, the one to store. */
  text: string;
  /** What the check held back from the first text; empty when it passed. */
  findings: Finding[];
  outcome: 'passed' | 'regenerated' | 'fallback';
  /** The turn as the next ones replay it: the model's messages, its text replaced by the one read. */
  replay: () => Promise<ResponseMessage[] | undefined>;
}

const ENDS = new Set<Chunk['type']>(['finish', 'error', 'abort']);
const TEXT = new Set<Chunk['type']>(['text-start', 'text-delta', 'text-end']);

async function readAll(stream: ReadableStream<Chunk>): Promise<Chunk[]> {
  const reader = stream.getReader();
  const chunks: Chunk[] = [];
  for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(next.value);
  return chunks;
}

/** The text of the held parts, each step's text apart. */
function textOf(chunks: readonly Chunk[]): string {
  return chunks.reduce((text, chunk) => {
    if (chunk.type === 'text-start') return text ? `${text}\n\n` : text;
    return chunk.type === 'text-delta' ? text + chunk.delta : text;
  }, '');
}

/** The model's messages with their text and reasoning taken out, then the text the student read: tool calls and results stay. */
function withText(messages: readonly ResponseMessage[], text: string): ResponseMessage[] {
  const tools = messages.flatMap((message): ResponseMessage[] => {
    if (message.role === 'tool') return [message];
    const content = typeof message.content === 'string' ? [] : message.content.filter((part) => part.type !== 'text' && part.type !== 'reasoning');
    return content.length > 0 ? [{ ...message, content }] : [];
  });
  return [...tools, { role: 'assistant', content: [{ type: 'text', text }] }];
}

export async function runControlledTurn(
  writer: UIMessageStreamWriter<TomChatMessage>,
  params: ChatStreamParams,
  check: OutputCheckContext,
): Promise<ControlledTurn> {
  const first = streamChat(params);
  const chunks = await readAll(toUIMessageStream<typeof params.tools, TomChatMessage>({ stream: first.stream, tools: params.tools, sendReasoning: false }));
  const firstText = textOf(chunks);
  const findings = firstText ? await checkReply(firstText, check) : [];

  if (findings.length === 0) {
    for (const chunk of chunks) writer.write(chunk);
    return { results: [first], text: firstText, findings, outcome: 'passed', replay: async () => first.responseMessages };
  }

  // A cut call cannot be redone within the turn, nor a tool call undone, nor a text checked
  // without moderation: no regeneration then.
  const cut = chunks.some((chunk) => chunk.type === 'error' || chunk.type === 'abort');
  const usedTools = chunks.some((chunk) => chunk.type === 'tool-input-available');
  const unmoderated = findings.some((finding) => finding.kind === 'unmoderated');
  const second = cut || usedTools || unmoderated
    ? null
    : streamChat({ ...params, tools: {}, turnInstruction: [params.turnInstruction, regenerationInstruction(findings)].filter(Boolean).join('\n\n') });
  const secondText = second ? await Promise.resolve(second.text).catch(() => '') : '';
  const passed = secondText !== '' && (await checkReply(secondText, check)).length === 0;
  const text = passed ? secondText : FALLBACK_REPLY;
  const outcome = passed ? 'regenerated' : 'fallback';
  logger.warn('Tutor message held back by the check', {
    operation: 'output-check:held',
    sessionId: params.sessionId,
    findings: findings.map((finding) => finding.kind),
    outcome,
    cut,
    usedTools,
    unmoderated,
  });

  for (const chunk of chunks) if (!TEXT.has(chunk.type) && !ENDS.has(chunk.type)) writer.write(chunk);
  const id = 'checked-text';
  writer.write({ type: 'text-start', id });
  writer.write({ type: 'text-delta', id, delta: text });
  writer.write({ type: 'text-end', id });
  for (const chunk of chunks) if (ENDS.has(chunk.type)) writer.write(chunk);

  return {
    results: second ? [first, second] : [first],
    text,
    findings,
    outcome,
    replay: async () => withText(await first.responseMessages, text),
  };
}
