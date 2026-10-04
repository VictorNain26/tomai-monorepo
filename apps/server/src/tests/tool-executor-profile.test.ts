/**
 * Tests unitaires - Tool Executor : executeUpdateProfile branch + isDeckCreatedResult
 *
 * Complète tool-executor.test.ts en couvrant :
 * - rejet explicite quand observation/subject sont vides
 * - merge + dédoublonnage de strengths/weaknesses avec le profil existant
 * - discriminator isDeckCreatedResult (kind === 'deck_created')
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// Cognitive profile — this is what we actually care about.
interface Profile {
  strengths: string[] | null;
  weaknesses: string[] | null;
  observations: unknown[];
  lastUpdatedByAgent: Date | null;
}

let existingProfile: Profile | null = null;

const updateProfileSpy = mock(async () => undefined);
const getProfileSpy = mock(async () => existingProfile);

mock.module('../modules/tutor/cognitive-profile.service', () => ({
  cognitiveProfileService: {
    getProfile: getProfileSpy,
    updateProfile: updateProfileSpy,
  },
}));

// Learning module (unused by the profile path but imported at module load)
mock.module('../modules/learning/index', () => ({
  generateCards: mock(async () => ({ cards: [], count: 0 })),
  learningService: {
    createDeckWithCards: mock(async () => ({ deck: { id: 'd', title: 't' }, cards: [] })),
  },
  getLevelConfig: mock(() => ({ cardsPerSession: 10 })),
}));

// DB (unused on this path)
mock.module('../db/connection', () => ({
  db: { transaction: mock(async (fn: (tx: unknown) => Promise<unknown>) => fn({})) },
}));

// Import after mocks
const { executeTool, isDeckCreatedResult } = await import('../modules/tutor/tool-executor');

const baseContext = {
  userId: 'user-001',
  schoolLevel: 'troisieme' as const,
  sessionId: 'session-001',
};

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  strengths: [],
  weaknesses: [],
  observations: [],
  lastUpdatedByAgent: null,
  ...overrides,
});

beforeEach(() => {
  existingProfile = null;
  updateProfileSpy.mockClear();
  getProfileSpy.mockClear();
});

// ============================================
// TESTS
// ============================================

describe('executeUpdateProfile()', () => {
  describe('validation', () => {
    it('should return error=true when observation is empty', async () => {
      const result = await executeTool('update_student_profile', {
        observation: '',
        subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(result['message']).toContain("Observation ou matière manquante");
      expect(updateProfileSpy).not.toHaveBeenCalled();
    });

    it('should return error=true when observation is whitespace-only', async () => {
      const result = await executeTool('update_student_profile', {
        observation: '   ',
        subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(updateProfileSpy).not.toHaveBeenCalled();
    });

    it('should return error=true when subject is empty', async () => {
      const result = await executeTool('update_student_profile', {
        observation: 'Bonne progression',
        subject: '',
      }, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(updateProfileSpy).not.toHaveBeenCalled();
    });

    it('should return error=true when subject is missing', async () => {
      const result = await executeTool('update_student_profile', {
        observation: 'Bonne progression',
      }, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(updateProfileSpy).not.toHaveBeenCalled();
    });
  });

  describe('merging with existing profile', () => {
    it('should merge a new strength with existing strengths (deduped)', async () => {
      existingProfile = makeProfile({ strengths: ['calcul mental', 'logique'] });
      const result = await executeTool('update_student_profile', {
        observation: 'Brille en géométrie', subject: 'mathematiques', strength: 'geometrie',
      }, baseContext) as Record<string, unknown>;
      expect(result['updated']).toBe(true);
      expect(updateProfileSpy).toHaveBeenCalledTimes(1);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[])[1] as { strengths?: string[] };
      expect(updates.strengths).toEqual(['calcul mental', 'logique', 'geometrie']);
    });

    it('should dedupe a strength that already exists', async () => {
      existingProfile = makeProfile({ strengths: ['calcul mental', 'logique'] });
      await executeTool('update_student_profile', {
        observation: 'Confirme bon niveau', subject: 'mathematiques', strength: 'calcul mental',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[])[1] as { strengths?: string[] };
      expect(updates.strengths).toEqual(['calcul mental', 'logique']);
    });

    it('should merge a new weakness with existing weaknesses', async () => {
      existingProfile = makeProfile({ weaknesses: ['fractions'] });
      await executeTool('update_student_profile', {
        observation: 'Difficulté sur aires', subject: 'mathematiques', weakness: 'aires',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[])[1] as { weaknesses?: string[] };
      expect(updates.weaknesses).toEqual(['fractions', 'aires']);
    });

    it('should cap strengths at 10 items (keeps most recent)', async () => {
      existingProfile = makeProfile({
        strengths: Array.from({ length: 10 }, (_, i) => `strength-${i}`),
      });
      await executeTool('update_student_profile', {
        observation: 'Nouvelle force', subject: 'mathematiques', strength: 'brand-new',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[])[1] as { strengths?: string[] };
      expect(updates.strengths).toHaveLength(10);
      expect(updates.strengths?.[9]).toBe('brand-new');
      expect(updates.strengths?.includes('strength-0')).toBe(false);
    });

    it('should not include strengths/weaknesses keys when not provided', async () => {
      existingProfile = makeProfile({ strengths: ['calcul'], weaknesses: ['fractions'] });
      await executeTool('update_student_profile', {
        observation: 'Juste une obs générale', subject: 'francais',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
      expect('strengths' in updates).toBe(false);
      expect('weaknesses' in updates).toBe(false);
    });

    it('should handle null existing profile (first-time write)', async () => {
      existingProfile = null;
      await executeTool('update_student_profile', {
        observation: 'Premier échange', subject: 'mathematiques', strength: 'curiosite',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[] | undefined)?.[1] as undefined | { strengths?: string[] };
      expect(updates?.strengths).toEqual(['curiosite']);
    });

    it('never writes a learning style, a neuromyth, even when the model sends one', async () => {
      existingProfile = null;
      await executeTool('update_student_profile', {
        observation: 'Préfère les diagrammes', subject: 'mathematiques', preferredStyle: 'visuel',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[] | undefined)?.[1] as undefined | Record<string, unknown>;
      expect(updates).not.toHaveProperty('preferredStyle');
    });

    it('answers with a transient error, never a success, when the write fails', async () => {
      existingProfile = null;
      updateProfileSpy.mockImplementationOnce(async () => { throw new Error('db down'); });
      const result = await executeTool('update_student_profile', { observation: 'Confond aire et périmètre', subject: 'mathematiques' }, baseContext) as Record<string, unknown>;
      expect(result).toMatchObject({ isError: true, errorCategory: 'transient' });
      expect(result['message']).toContain("sans en parler à l'élève");
      expect(result).not.toHaveProperty('updated');
    });

    it('writes nothing when the profile cannot be read: an empty merge would erase it', async () => {
      getProfileSpy.mockImplementationOnce(async () => { throw new Error('db down'); });
      const result = await executeTool('update_student_profile', { observation: 'Confond aire et périmètre', subject: 'mathematiques', strength: 'Curieux' }, baseContext) as Record<string, unknown>;
      expect(result).toMatchObject({ isError: true, errorCategory: 'transient' });
      expect(updateProfileSpy).not.toHaveBeenCalled();
    });

    it('should truncate observation at 250 chars', async () => {
      existingProfile = null;
      await executeTool('update_student_profile', {
        observation: 'x'.repeat(500), subject: 'mathematiques',
      }, baseContext);
      const updates = (updateProfileSpy.mock.calls[0] as unknown[] | undefined)?.[1] as undefined | { observation?: string };
      expect(updates?.observation?.length).toBeLessThanOrEqual(250);
    });
  });
});

describe('isDeckCreatedResult()', () => {
  it('should return true for kind === "deck_created"', () => {
    const result = { kind: 'deck_created', generated: true, deckId: 'd-1' };
    expect(isDeckCreatedResult(result)).toBe(true);
  });

  it('should return false for wrong/missing discriminator', () => {
    expect(isDeckCreatedResult({ generated: true, deckId: 'd' })).toBe(false);
    expect(isDeckCreatedResult({ kind: 'other_kind', deckId: 'd' })).toBe(false);
    expect(isDeckCreatedResult({ error: true, message: 'nope' })).toBe(false);
  });

  it('should return false for null / undefined / primitives / arrays', () => {
    expect(isDeckCreatedResult(null)).toBe(false);
    expect(isDeckCreatedResult(undefined)).toBe(false);
    expect(isDeckCreatedResult('deck_created')).toBe(false);
    expect(isDeckCreatedResult(42)).toBe(false);
    expect(isDeckCreatedResult(true)).toBe(false);
    expect(isDeckCreatedResult([])).toBe(false);
    expect(isDeckCreatedResult(['deck_created'])).toBe(false);
  });

  it('should narrow the type so consumers can access deckId safely', () => {
    const maybe: unknown = {
      kind: 'deck_created', generated: true, deckId: 'd-42',
      deckTitle: 'T', cardCount: 1, topic: 't', subject: 's', message: 'm',
    };
    if (isDeckCreatedResult(maybe)) {
      expect(maybe.deckId).toBe('d-42');
      expect(maybe.generated).toBe(true);
    } else {
      throw new Error('expected narrow to pass');
    }
  });
});
