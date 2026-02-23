/**
 * Education Levels Tests
 *
 * Tests for level helpers and constants.
 */

import {
  LEVEL_LABELS,
  getLevelLabel,
  type EducationLevelType,
} from '../../src/constants/levels';

describe('LEVEL_LABELS', () => {
  it('should have labels for all levels', () => {
    const allLevels: EducationLevelType[] = [
      'cp',
      'ce1',
      'ce2',
      'cm1',
      'cm2',
      'sixieme',
      'cinquieme',
      'quatrieme',
      'troisieme',
      'seconde',
      'premiere',
      'terminale',
    ];

    for (const level of allLevels) {
      expect(LEVEL_LABELS[level]).toBeDefined();
      expect(typeof LEVEL_LABELS[level]).toBe('string');
    }
  });

  it('should have correct French labels', () => {
    expect(LEVEL_LABELS.sixieme).toBe('6ème');
    expect(LEVEL_LABELS.cinquieme).toBe('5ème');
    expect(LEVEL_LABELS.quatrieme).toBe('4ème');
    expect(LEVEL_LABELS.troisieme).toBe('3ème');
  });
});

describe('getLevelLabel', () => {
  it('should return correct label for known levels', () => {
    expect(getLevelLabel('sixieme')).toBe('6ème');
    expect(getLevelLabel('cp')).toBe('CP');
    expect(getLevelLabel('terminale')).toBe('Terminale');
  });

  it('should return key as fallback for unknown levels', () => {
    expect(getLevelLabel('unknown')).toBe('unknown');
  });
});
