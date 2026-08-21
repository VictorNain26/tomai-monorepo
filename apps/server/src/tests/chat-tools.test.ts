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

const { buildChatTools } = await import('../services/chat/chat-tools');

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

// ============================================
// Contraintes de schéma — migrées depuis tool-declarations.test.ts
//
// Ces bornes étaient asserted sur `agentTools`, un jeu de déclarations que
// plus aucun chemin de production ne consommait. Elles sont désormais
// vérifiées sur les schémas Zod réellement envoyés au modèle, donc une dérive
// de la contrainte est visible.
// ============================================

describe('contraintes des schémas Zod', () => {
  const tools = buildChatTools(baseContext);

  const parse = (name: string, input: unknown) =>
    (tools[name]!.inputSchema as { safeParse: (v: unknown) => { success: boolean } }).safeParse(input);

  describe('generate_flashcards.cardCount', () => {
    const base = { topic: 'Pythagore', subject: 'mathematiques' };

    it('refuse en dessous de 3', () => {
      expect(parse('generate_flashcards', { ...base, cardCount: 2 }).success).toBe(false);
    });

    it('refuse au-dessus de 10', () => {
      expect(parse('generate_flashcards', { ...base, cardCount: 11 }).success).toBe(false);
    });

    it('accepte les bornes 3 et 10', () => {
      expect(parse('generate_flashcards', { ...base, cardCount: 3 }).success).toBe(true);
      expect(parse('generate_flashcards', { ...base, cardCount: 10 }).success).toBe(true);
    });

    it('accepte son absence (valeur par défaut côté exécuteur)', () => {
      expect(parse('generate_flashcards', base).success).toBe(true);
    });
  });

  describe('update_student_profile — longueurs maximales', () => {
    const base = { observation: 'Confond les groupes verbaux.', subject: 'francais' };

    it('refuse une observation de plus de 250 caractères', () => {
      expect(parse('update_student_profile', { ...base, observation: 'a'.repeat(251) }).success).toBe(false);
      expect(parse('update_student_profile', { ...base, observation: 'a'.repeat(250) }).success).toBe(true);
    });

    it('refuse une force de plus de 100 caractères', () => {
      expect(parse('update_student_profile', { ...base, strength: 'a'.repeat(101) }).success).toBe(false);
      expect(parse('update_student_profile', { ...base, strength: 'a'.repeat(100) }).success).toBe(true);
    });

    it('refuse une faiblesse de plus de 100 caractères', () => {
      expect(parse('update_student_profile', { ...base, weakness: 'a'.repeat(101) }).success).toBe(false);
      expect(parse('update_student_profile', { ...base, weakness: 'a'.repeat(100) }).success).toBe(true);
    });

    it('laisse la matière libre — une observation peut porter sur une matière hors RAG', () => {
      expect(parse('update_student_profile', { ...base, subject: 'education_musicale' }).success).toBe(true);
    });

    it('refuse un style d\'apprentissage hors énumération', () => {
      expect(parse('update_student_profile', { ...base, preferredStyle: 'telepathique' }).success).toBe(false);
      expect(parse('update_student_profile', { ...base, preferredStyle: 'visuel' }).success).toBe(true);
    });
  });
});

describe('RAG_SUBJECTS', () => {
  it('expose des slugs non vides et sans doublon', async () => {
    const { RAG_SUBJECTS } = await import('../services/chat/rag-subjects');
    expect(RAG_SUBJECTS.length).toBeGreaterThan(0);
    expect(RAG_SUBJECTS.every(s => s.trim().length > 0)).toBe(true);
    expect(new Set(RAG_SUBJECTS).size).toBe(RAG_SUBJECTS.length);
  });

  it('sert d\'énumération aux deux outils qui filtrent par matière', async () => {
    const { RAG_SUBJECTS } = await import('../services/chat/rag-subjects');
    const tools = buildChatTools(baseContext);
    const parse = (name: string, input: unknown) =>
      (tools[name]!.inputSchema as { safeParse: (v: unknown) => { success: boolean } }).safeParse(input);

    for (const matiere of RAG_SUBJECTS) {
      expect(parse('search_educational_content', { query: 'q', niveau: 'troisieme', matiere }).success).toBe(true);
      expect(parse('generate_flashcards', { topic: 't', subject: matiere }).success).toBe(true);
    }
  });
});
