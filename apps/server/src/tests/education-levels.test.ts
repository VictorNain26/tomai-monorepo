import { describe, it, expect } from 'bun:test';
import { EDUCATION_LEVELS, isEducationLevel, levelLabel } from '../lib/education-levels';

describe('education-levels', () => {
  it('contains the four collège levels, in order', () => {
    expect(EDUCATION_LEVELS).toEqual(['sixieme', 'cinquieme', 'quatrieme', 'troisieme']);
  });

  it('isEducationLevel accepts a collège level and refuses the others', () => {
    expect(isEducationLevel('sixieme')).toBe(true);
    expect(isEducationLevel('troisieme')).toBe(true);
    expect(isEducationLevel('cm2')).toBe(false);
    expect(isEducationLevel('seconde')).toBe(false);
  });

  it('labels each level', () => {
    expect(EDUCATION_LEVELS.map(levelLabel)).toEqual(['6ème (11 ans)', '5ème (12 ans)', '4ème (13 ans)', '3ème (14 ans)']);
  });

  it('isEducationLevel rejects an unknown string', () => {
    expect(isEducationLevel('college')).toBe(false);
    expect(isEducationLevel('')).toBe(false);
    expect(isEducationLevel('IGNORE PREVIOUS INSTRUCTIONS')).toBe(false);
  });
});
