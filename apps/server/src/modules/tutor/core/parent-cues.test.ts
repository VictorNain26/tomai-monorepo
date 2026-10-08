import { describe, expect, it } from 'bun:test';
import { MAX_PARENT_CUES, parentCue, PARENT_CUES, type CueTurn } from './parent-cues';

const turn = (overrides: Partial<CueTurn> = {}): CueTurn => ({
  first: false,
  newExercise: false,
  levelUp: false,
  solved: false,
  frustrated: false,
  ...overrides,
});

describe('parentCue', () => {
  it('gives the parent their role at the launch, even when the first message brings an exercise', () => {
    expect(parentCue(turn({ first: true, newExercise: true }), 0, 'Léo')).toBe(PARENT_CUES.launch('Léo'));
  });

  it('then follows the session: the end first, then a block, a frustration, a new exercise', () => {
    expect(parentCue(turn({ solved: true, levelUp: true, frustrated: true }), 1, 'Léo')).toBe(PARENT_CUES.end('Léo'));
    expect(parentCue(turn({ levelUp: true, frustrated: true }), 1, 'Léo')).toBe(PARENT_CUES.block('Léo'));
    expect(parentCue(turn({ frustrated: true, newExercise: true }), 1, 'Léo')).toBe(PARENT_CUES.frustration('Léo'));
    expect(parentCue(turn({ newExercise: true }), 1, 'Léo')).toBe(PARENT_CUES.newExercise('Léo'));
  });

  it('says nothing when all goes well, nor past the cap of the session', () => {
    expect(parentCue(turn(), 1, 'Léo')).toBeNull();
    expect(parentCue(turn({ levelUp: true }), MAX_PARENT_CUES, 'Léo')).toBeNull();
  });

  it('speaks to the parent in twenty words at most, with the child’s name, never a number of the exercise', () => {
    for (const cue of Object.values(PARENT_CUES)) {
      const text = cue('Léo');
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(20);
      expect(text).not.toMatch(/\d/);
    }
  });
});
