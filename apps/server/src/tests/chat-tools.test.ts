/**
 * Tests unitaires - Chat Tools (services/chat/chat-tools.ts)
 *
 * Verifies the AI SDK `tool()` wrapping: the 4 tool keys, the JSON Schema the
 * model receives for each input, and that generate_flashcards calls
 * `emitDeckCreated` on a deck_created result. Delegation to the
 * underlying tool-executor is mocked, not re-tested here (see
 * tool-executor.test.ts).
 */

import { describe, it, expect, mock } from 'bun:test';
import { asSchema, type ToolSet } from 'ai';
import type { TomMetadata } from '../services/chat/chat-ui-message';

// ============================================
// MOCKS — tool-executor.ts is the single delegation point
// ============================================

let executeToolResult: unknown = { ok: true };
const executeToolMock = mock(async () => executeToolResult);

mock.module('../services/chat/tool-executor', () => ({
  executeTool: executeToolMock,
  isDeckCreatedResult: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'deck_created',
}));

const { buildChatTools, SUBJECT_SLUGS } = await import('../services/chat/chat-tools');

const baseContext = {
  userId: 'user-001',
  sessionId: 'session-001',
  schoolLevel: 'troisieme' as const,
  userRole: 'student' as const,
  emitDeckCreated: mock(() => {}),
};

describe('TomMetadata', () => {
  it('types speakable as a boolean', () => {
    // Compile-time assertion: fails to typecheck if `speakable` is missing or
    // typed as anything but boolean. The runtime assertion below is
    // incidental — the check that matters is `bun run typecheck`.
    const metadata: TomMetadata = { speakable: true };
    expect(metadata.speakable).toBe(true);
  });
});

describe('buildChatTools', () => {
  it('exposes exactly the 4 declared tool keys', () => {
    const tools = buildChatTools(baseContext);
    expect(Object.keys(tools).sort()).toEqual([
      'generate_flashcards',
      'get_app_help',
      'get_student_profile',
      'update_student_profile',
    ]);
  });

  describe('input JSON Schema', () => {
    const tools: ToolSet = buildChatTools(baseContext);

    async function propertiesOf(name: string): Promise<Record<string, Record<string, unknown>>> {
      const schema = await asSchema(tools[name]?.inputSchema).jsonSchema;
      return schema.properties as Record<string, Record<string, unknown>>;
    }

    it('exports 13 non-empty subject slugs', () => {
      expect(SUBJECT_SLUGS.length).toBe(13);
      for (const slug of SUBJECT_SLUGS) {
        expect(slug.length).toBeGreaterThan(0);
      }
    });

    it('generate_flashcards.subject is the SUBJECT_SLUGS enum', async () => {
      const props = await propertiesOf('generate_flashcards');
      expect(props.subject?.enum).toEqual([...SUBJECT_SLUGS]);
    });

    it('generate_flashcards.cardCount is bounded to 3..10', async () => {
      const props = await propertiesOf('generate_flashcards');
      expect(props.cardCount?.minimum).toBe(3);
      expect(props.cardCount?.maximum).toBe(10);
    });

    it('update_student_profile.subject is free text (no enum)', async () => {
      const props = await propertiesOf('update_student_profile');
      expect(props.subject?.enum).toBeUndefined();
    });

    it('update_student_profile bounds observation, strength and weakness', async () => {
      const props = await propertiesOf('update_student_profile');
      expect(props.observation?.maxLength).toBe(250);
      expect(props.strength?.maxLength).toBe(100);
      expect(props.weakness?.maxLength).toBe(100);
    });
  });

  describe('generate_flashcards.execute', () => {
    it('calls emitDeckCreated when the executor returns a deck_created result', async () => {
      executeToolResult = {
        kind: 'deck_created',
        generated: true,
        deckId: 'deck-1',
        deckTitle: 'Fractions',
        cardCount: 5,
        topic: 'Fractions',
        subject: 'mathematiques',
        message: '5 cartes créées.',
      };
      const emitDeckCreated = mock(() => {});
      const tools = buildChatTools({ ...baseContext, emitDeckCreated });
      const tool = tools.generate_flashcards;
      if (!tool.execute) throw new Error('generate_flashcards must have an execute function');

      await tool.execute(
        { topic: 'Fractions', subject: 'mathematiques' },
        { toolCallId: 'call-1', messages: [], context: undefined },
      );

      expect(emitDeckCreated).toHaveBeenCalledTimes(1);
      expect(emitDeckCreated).toHaveBeenCalledWith({
        deckId: 'deck-1',
        title: 'Fractions',
        cardCount: 5,
        subject: 'mathematiques',
      });
    });

    it('does not call emitDeckCreated on a non deck_created result', async () => {
      executeToolResult = { isError: true, errorCategory: 'business', message: 'failed' };
      const emitDeckCreated = mock(() => {});
      const tools = buildChatTools({ ...baseContext, emitDeckCreated });
      const tool = tools.generate_flashcards;
      if (!tool.execute) throw new Error('generate_flashcards must have an execute function');

      await tool.execute(
        { topic: 'Fractions', subject: 'mathematiques' },
        { toolCallId: 'call-2', messages: [], context: undefined },
      );

      expect(emitDeckCreated).not.toHaveBeenCalled();
    });
  });
});
