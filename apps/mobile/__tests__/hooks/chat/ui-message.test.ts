/**
 * ui-message helpers — deriveStreamStatus tests
 *
 * `deriveStreamStatus` maps the last in-flight tool part of the streaming
 * assistant message to the same French status labels the legacy SSE route
 * used (`getToolStatusLabel` in `apps/server/.../mistral-helpers.ts`).
 */

import type { TomChatMessage } from '@repo/api';

// The real `ai` package is ESM-only (pulls in `@ai-sdk/gateway`, not
// transformable by Jest) — `deriveStreamStatus` only needs the pure
// `isToolUIPart`/`getToolName` helpers, reimplemented here against the same
// `type: 'tool-<name>'` / `state` shape documented in `ai/dist/index.d.ts`.
jest.mock('ai', () => ({
  isTextUIPart: (part: { type: string }) => part.type === 'text',
  isToolUIPart: (part: { type: string }) => part.type.startsWith('tool-') || part.type === 'dynamic-tool',
  getToolName: (part: { type: string; toolName?: string }) =>
    part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length),
}));

import { deriveStreamStatus } from '../../../src/hooks/chat/ui-message';

function assistantMessage(parts: TomChatMessage['parts']): TomChatMessage {
  return { id: 'a1', role: 'assistant', parts };
}

describe('deriveStreamStatus', () => {
  it('maps an in-flight tool part (input-streaming) to its French label', () => {
    const message = assistantMessage([
      {
        type: 'tool-search_educational_content',
        toolCallId: 'call-1',
        state: 'input-streaming',
        input: undefined,
      },
    ]);

    expect(deriveStreamStatus(message)).toBe('Recherche dans les programmes...');
  });

  it('maps an in-flight tool part (input-available) to its French label', () => {
    const message = assistantMessage([
      {
        type: 'tool-generate_flashcards',
        toolCallId: 'call-1',
        state: 'input-available',
        input: {},
      },
    ]);

    expect(deriveStreamStatus(message)).toBe('Création de flashcards...');
  });

  it('falls back to the generic label for an unmapped tool name', () => {
    const message = assistantMessage([
      {
        type: 'tool-unknown_tool',
        toolCallId: 'call-1',
        state: 'input-available',
        input: {},
      },
    ]);

    expect(deriveStreamStatus(message)).toBe('Traitement en cours...');
  });

  it('returns null once the tool part has its output', () => {
    const message = assistantMessage([
      {
        type: 'tool-search_educational_content',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: {},
      },
    ]);

    expect(deriveStreamStatus(message)).toBeNull();
  });

  it('returns null with no tool part (text only)', () => {
    const message = assistantMessage([{ type: 'text', text: 'Salut !' }]);

    expect(deriveStreamStatus(message)).toBeNull();
  });

  it('returns null for a user message', () => {
    const message: TomChatMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        {
          type: 'tool-search_educational_content',
          toolCallId: 'call-1',
          state: 'input-streaming',
          input: undefined,
        },
      ],
    };

    expect(deriveStreamStatus(message)).toBeNull();
  });

  it('returns null with no message', () => {
    expect(deriveStreamStatus(undefined)).toBeNull();
  });
});
