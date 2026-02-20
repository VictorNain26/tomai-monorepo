/**
 * Education Levels Tests
 *
 * Tests for level helpers and constants.
 */

import {
  LEVELS,
  CYCLES,
  LEVEL_LABELS,
  getLevelLabel,
  type EducationLevelType,
  type CycleId,
} from '../../src/constants/levels';

describe('LEVELS', () => {
  it('should contain all 12 education levels', () => {
    expect(LEVELS).toHaveLength(12);
  });

  it('should have correct structure for each level', () => {
    for (const level of LEVELS) {
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('label');
      expect(level).toHaveProperty('cycle');
      expect(typeof level.id).toBe('string');
      expect(typeof level.label).toBe('string');
    }
  });

  it('should have levels in correct order (CP to Terminale)', () => {
    const expectedOrder: EducationLevelType[] = [
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

    const actualOrder = LEVELS.map((l) => l.id);
    expect(actualOrder).toEqual(expectedOrder);
  });
});

describe('CYCLES', () => {
  it('should contain all 4 cycles', () => {
    const cycleIds: CycleId[] = ['cycle2', 'cycle3', 'cycle4', 'lycee'];
    for (const cycleId of cycleIds) {
      expect(CYCLES[cycleId]).toBeDefined();
    }
  });

  it('should have correct levels in cycle2', () => {
    expect(CYCLES.cycle2.levels).toEqual(['cp', 'ce1', 'ce2']);
  });

  it('should have correct levels in cycle3', () => {
    expect(CYCLES.cycle3.levels).toEqual(['cm1', 'cm2', 'sixieme']);
  });

  it('should have correct levels in cycle4', () => {
    expect(CYCLES.cycle4.levels).toEqual(['cinquieme', 'quatrieme', 'troisieme']);
  });

  it('should have correct levels in lycee', () => {
    expect(CYCLES.lycee.levels).toEqual(['seconde', 'premiere', 'terminale']);
  });
});

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

