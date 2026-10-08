import { describe, expect, it } from 'bun:test';
import { MAX_PARENT_CUES, parentCue, PARENT_CUES, type CueTurn } from './parent-cues';

const turn = (overrides: Partial<CueTurn> = {}): CueTurn => ({
  first: false,
  helped: true,
  newExercise: false,
  levelUp: false,
  solved: false,
  frustrated: false,
  ...overrides,
});
const none = { shown: 1, last: 'launch' as const };

describe('parentCue', () => {
  it('gives the parent their role at the launch, even when the first message brings an exercise', () => {
    expect(parentCue(turn({ first: true, newExercise: true }), { shown: 0, last: null }, 'Léo')).toEqual({
      kind: 'launch',
      text: PARENT_CUES.launch('Léo'),
    });
  });

  it('then follows the session: the end first, then a block, a frustration, a new exercise', () => {
    expect(parentCue(turn({ solved: true, levelUp: true, frustrated: true }), none, 'Léo')?.kind).toBe('end');
    expect(parentCue(turn({ levelUp: true, frustrated: true }), none, 'Léo')?.kind).toBe('block');
    expect(parentCue(turn({ frustrated: true, newExercise: true }), none, 'Léo')?.kind).toBe('frustration');
    expect(parentCue(turn({ newExercise: true }), none, 'Léo')?.kind).toBe('newExercise');
  });

  it('tells no end nor block of a turn whose fixed reply moved nothing on the exercise', () => {
    expect(parentCue(turn({ helped: false, solved: true }), none, 'Léo')).toBeNull();
    expect(parentCue(turn({ helped: false, levelUp: true, frustrated: true }), none, 'Léo')?.kind).toBe('frustration');
  });

  it('never gives the same cue twice in a row, so the session keeps cues for what comes', () => {
    expect(parentCue(turn({ frustrated: true }), { shown: 2, last: 'frustration' }, 'Léo')).toBeNull();
    expect(parentCue(turn({ levelUp: true }), { shown: 2, last: 'frustration' }, 'Léo')?.kind).toBe('block');
  });

  it('says nothing when all goes well, nor past the cap of the session', () => {
    expect(parentCue(turn(), none, 'Léo')).toBeNull();
    expect(parentCue(turn({ levelUp: true }), { shown: MAX_PARENT_CUES, last: 'frustration' }, 'Léo')).toBeNull();
  });

  it('speaks to the parent in twenty words at most, with the child’s name, never a number of the exercise', () => {
    for (const cue of Object.values(PARENT_CUES)) {
      const text = cue('Léo');
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(20);
      expect(text).toContain('Léo');
      expect(text).not.toMatch(/\d/);
    }
  });
});
