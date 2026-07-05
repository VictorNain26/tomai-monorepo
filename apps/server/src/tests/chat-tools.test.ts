/**
 * Tests unitaires - Chat Tools (services/chat/chat-tools.ts)
 *
 * Verifies the AI SDK `tool()` wrapping: the 5 tool keys, the Zod input
 * schemas (mirroring tool-declarations.ts enums), and that generate_flashcards
 * calls `emitDeckCreated` on a deck_created result. Delegation to the
 * underlying tool-executor is mocked, not re-tested here (see
 * tool-executor.test.ts).
 */

import { describe, it, expect, mock } from 'bun:test';

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

const { buildChatTools } = await import('../services/chat/chat-tools');

const baseContext = {
  userId: 'user-001',
  sessionId: 'session-001',
  schoolLevel: 'troisieme' as const,
  userRole: 'student' as const,
  emitDeckCreated: mock(() => {}),
};

describe('buildChatTools', () => {
  it('exposes exactly the 5 declared tool keys', () => {
    const tools = buildChatTools(baseContext);
    expect(Object.keys(tools).sort()).toEqual([
      'generate_flashcards',
      'get_app_help',
      'get_student_profile',
      'search_educational_content',
      'update_student_profile',
    ]);
  });

  describe('search_educational_content.inputSchema', () => {
    it('rejects an out-of-enum niveau', () => {
      const tools = buildChatTools(baseContext);
      const schema = tools.search_educational_content.inputSchema as { parse: (v: unknown) => unknown };
      expect(() =>
        schema.parse({ query: 'test', niveau: 'licence', matiere: 'mathematiques' }),
      ).toThrow();
    });

    it('accepts a valid niveau from the declared enum', () => {
      const tools = buildChatTools(baseContext);
      const schema = tools.search_educational_content.inputSchema as { parse: (v: unknown) => unknown };
      expect(() =>
        schema.parse({ query: 'test', niveau: 'sixieme', matiere: 'mathematiques' }),
      ).not.toThrow();
    });

    it('rejects an out-of-enum matiere', () => {
      const tools = buildChatTools(baseContext);
      const schema = tools.search_educational_content.inputSchema as { parse: (v: unknown) => unknown };
      expect(() =>
        schema.parse({ query: 'test', niveau: 'sixieme', matiere: 'latin' }),
      ).toThrow();
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

  describe('search_educational_content.execute', () => {
    it('fences the executor result via wrapCurriculumToolResult', async () => {
      executeToolResult = {
        found: true,
        context: 'Le théorème de Pythagore énonce...',
        resultsCount: 1,
        bestMatchSection: 'Géométrie',
        bestMatchMatiere: 'mathematiques',
        chunks: [{ section: 'Géométrie', matiere: 'mathematiques' }],
      };
      const tools = buildChatTools(baseContext);
      const tool = tools.search_educational_content;
      if (!tool.execute) throw new Error('search_educational_content must have an execute function');

      const output = await tool.execute(
        { query: 'pythagore', niveau: 'quatrieme', matiere: 'mathematiques' },
        { toolCallId: 'call-3', messages: [], context: undefined },
      );

      expect(typeof output).toBe('string');
      expect(output as string).toContain('<curriculum_excerpt>');
      expect(output as string).toContain('Le théorème de Pythagore énonce...');
    });
  });
});
