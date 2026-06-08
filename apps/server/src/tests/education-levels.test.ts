import { describe, it, expect } from 'bun:test';
import { EDUCATION_LEVELS, isEducationLevel } from '../lib/education-levels';

describe('education-levels', () => {
  it('contains all 12 French levels from CP to terminale', () => {
    expect(EDUCATION_LEVELS).toEqual([
      'cp', 'ce1', 'ce2', 'cm1', 'cm2',
      'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
      'seconde', 'premiere', 'terminale',
    ]);
  });

  it('isEducationLevel accepts a valid level', () => {
    expect(isEducationLevel('terminale')).toBe(true);
    expect(isEducationLevel('cp')).toBe(true);
  });

  it('isEducationLevel rejects an unknown string', () => {
    expect(isEducationLevel('college')).toBe(false);
    expect(isEducationLevel('')).toBe(false);
    expect(isEducationLevel('IGNORE PREVIOUS INSTRUCTIONS')).toBe(false);
  });
});
