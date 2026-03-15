/**
 * Pronote Helpers Tests
 *
 * Tests for date formatting, overdue detection, grade styling, and week labels.
 */

import { bgColors, borderColors } from '@/lib/styles';
import type { ThemeColors } from '@/hooks/useThemeColors';
import {
  formatDateShort,
  formatDateWithDay,
  getDaysUntil,
  getGradeStyle,
  getWeekLabel,
  isLowGrade,
  isOverdue,
} from '@/lib/pronote-helpers';

const mockColors: ThemeColors = {
  primary: '#2563EB',
  primaryForeground: '#FFFFFF',
  success: '#059669',
  successForeground: '#FFFFFF',
  warning: '#D97706',
  warningForeground: '#FFFFFF',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  info: '#0EA5E9',
  infoForeground: '#FFFFFF',
  foreground: '#1E293B',
  muted: '#64748B',
  background: '#F8FAFC',
  border: '#E2E8F0',
  card: '#FFFFFF',
};

// ============================================================================
// DATE HELPERS
// ============================================================================

describe('formatDateShort', () => {
  it('should contain the numeric day', () => {
    const result = formatDateShort('2026-01-12');
    expect(result).toContain('12');
  });

  it('should format a different month correctly', () => {
    const result = formatDateShort('2026-09-03');
    expect(result).toContain('3');
  });
});

describe('formatDateWithDay', () => {
  it('should contain the numeric day', () => {
    // 2026-01-12 is a Monday
    const result = formatDateWithDay('2026-01-12');
    expect(result).toContain('12');
  });

  it('should format a different weekday correctly', () => {
    // 2026-03-06 is a Friday
    const result = formatDateWithDay('2026-03-06');
    expect(result).toContain('6');
  });
});

// ============================================================================
// OVERDUE & DAYS UNTIL (time-sensitive — use fake timers)
// ============================================================================

describe('isOverdue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-02T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return true when past due and not done', () => {
    expect(isOverdue('2026-02-28', false)).toBe(true);
  });

  it('should return false when past due but done', () => {
    expect(isOverdue('2026-02-28', true)).toBe(false);
  });

  it('should return false when due in the future', () => {
    expect(isOverdue('2026-03-10', false)).toBe(false);
  });

  it('should return false when due today', () => {
    expect(isOverdue('2026-03-02', false)).toBe(false);
  });
});

describe('getDaysUntil', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-02T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return 1 for tomorrow', () => {
    expect(getDaysUntil('2026-03-03')).toBe(1);
  });

  it('should return -1 for yesterday', () => {
    expect(getDaysUntil('2026-03-01')).toBe(-1);
  });

  it('should return 0 for today', () => {
    expect(getDaysUntil('2026-03-02')).toBe(0);
  });
});

// ============================================================================
// GRADE HELPERS
// ============================================================================

describe('getGradeStyle', () => {
  it('should return muted style for null value', () => {
    const style = getGradeStyle(null, 20, mockColors);
    expect(style).toEqual({
      textColor: mockColors.muted,
      bgColor: bgColors.muted[50],
      borderColor: borderColors.muted[20],
    });
  });

  it('should return success style for 80%+', () => {
    const style = getGradeStyle(16, 20, mockColors);
    expect(style).toEqual({
      textColor: mockColors.success,
      bgColor: bgColors.success[10],
      borderColor: borderColors.success[30],
    });
  });

  it('should return primary style for 60-79%', () => {
    const style = getGradeStyle(13, 20, mockColors);
    expect(style).toEqual({
      textColor: mockColors.primary,
      bgColor: bgColors.primary[10],
      borderColor: borderColors.primary[30],
    });
  });

  it('should return warning style for 40-59%', () => {
    const style = getGradeStyle(8, 20, mockColors);
    expect(style).toEqual({
      textColor: mockColors.warning,
      bgColor: bgColors.warning[10],
      borderColor: borderColors.warning[30],
    });
  });

  it('should return destructive style for below 40%', () => {
    const style = getGradeStyle(5, 20, mockColors);
    expect(style).toEqual({
      textColor: mockColors.destructive,
      bgColor: bgColors.destructive[10],
      borderColor: borderColors.destructive[30],
    });
  });
});

describe('isLowGrade', () => {
  it('should return false for null value', () => {
    expect(isLowGrade(null, 20)).toBe(false);
  });

  it('should return false when outOf is 0', () => {
    expect(isLowGrade(5, 0)).toBe(false);
  });

  it('should return true for grade below 50%', () => {
    expect(isLowGrade(9, 20)).toBe(true); // 45%
  });

  it('should return false for grade at or above 50%', () => {
    expect(isLowGrade(11, 20)).toBe(false); // 55%
  });
});

// ============================================================================
// WEEK LABEL
// ============================================================================

describe('getWeekLabel', () => {
  it('should return "Cette semaine" for offset 0', () => {
    expect(getWeekLabel(0)).toBe('Cette semaine');
  });

  it('should return "Semaine +1" for offset 1', () => {
    expect(getWeekLabel(1)).toBe('Semaine +1');
  });

  it('should return "Semaine -1" for offset -1', () => {
    expect(getWeekLabel(-1)).toBe('Semaine -1');
  });

  it('should return "Semaine -3" for offset -3', () => {
    expect(getWeekLabel(-3)).toBe('Semaine -3');
  });
});
