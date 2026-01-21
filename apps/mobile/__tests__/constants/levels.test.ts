/**
 * Education Levels Tests
 *
 * Tests for level helpers and constants.
 */

import {
  LEVELS,
  CYCLES,
  LEVEL_LABELS,
  LV2_OPTIONS,
  getLevelLabel,
  isLv2Eligible,
  getLv2Label,
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

describe('LV2_OPTIONS', () => {
  it('should have exactly 3 LV2 options', () => {
    expect(LV2_OPTIONS).toHaveLength(3);
  });

  it('should contain espagnol, allemand, and italien', () => {
    const values = LV2_OPTIONS.map((o) => o.value);
    expect(values).toContain('espagnol');
    expect(values).toContain('allemand');
    expect(values).toContain('italien');
  });
});

describe('isLv2Eligible', () => {
  it('should return true for cinquieme and above', () => {
    expect(isLv2Eligible('cinquieme')).toBe(true);
    expect(isLv2Eligible('quatrieme')).toBe(true);
    expect(isLv2Eligible('troisieme')).toBe(true);
    expect(isLv2Eligible('seconde')).toBe(true);
    expect(isLv2Eligible('premiere')).toBe(true);
    expect(isLv2Eligible('terminale')).toBe(true);
  });

  it('should return false for sixieme and below', () => {
    expect(isLv2Eligible('cp')).toBe(false);
    expect(isLv2Eligible('ce1')).toBe(false);
    expect(isLv2Eligible('ce2')).toBe(false);
    expect(isLv2Eligible('cm1')).toBe(false);
    expect(isLv2Eligible('cm2')).toBe(false);
    expect(isLv2Eligible('sixieme')).toBe(false);
  });

  it('should return false for unknown levels', () => {
    expect(isLv2Eligible('unknown')).toBe(false);
  });
});

describe('getLv2Label', () => {
  it('should return correct label for LV2 options', () => {
    expect(getLv2Label('espagnol')).toBe('Espagnol');
    expect(getLv2Label('allemand')).toBe('Allemand');
    expect(getLv2Label('italien')).toBe('Italien');
  });

  it('should return null for null or undefined', () => {
    expect(getLv2Label(null)).toBeNull();
    expect(getLv2Label(undefined)).toBeNull();
  });
});
