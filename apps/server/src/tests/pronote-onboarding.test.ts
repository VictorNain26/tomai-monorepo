/**
 * Tests — pronote-onboarding helpers (pure, no I/O)
 *
 * Covers: splitName, inferSchoolLevel, matchExistingChild
 */

import { describe, it, expect } from 'bun:test';
import { splitName, inferSchoolLevel, matchExistingChild } from '../lib/pronote-onboarding';

// ============================================
// splitName
// ============================================

describe('splitName', () => {
  it('splits a single-word first name and single-word last name', () => {
    expect(splitName('Emma DUPONT')).toEqual({ firstName: 'Emma', lastName: 'DUPONT' });
  });

  it('treats first token as firstName and the rest as lastName', () => {
    expect(splitName('Jean-Pierre DE LA FONTAINE')).toEqual({
      firstName: 'Jean-Pierre',
      lastName: 'DE LA FONTAINE',
    });
  });

  it('handles multiple spaces between tokens', () => {
    expect(splitName('Emma  DUPONT')).toEqual({ firstName: 'Emma', lastName: 'DUPONT' });
  });

  it('returns empty strings for empty input', () => {
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
  });

  it('returns full string as firstName when only one token', () => {
    expect(splitName('Mononymous')).toEqual({ firstName: 'Mononymous', lastName: '' });
  });
});

// ============================================
// inferSchoolLevel
// ============================================

describe('inferSchoolLevel', () => {
  it('returns null for null input', () => {
    expect(inferSchoolLevel(null)).toBeNull();
  });

  it('returns null for unrecognized class like "302"', () => {
    expect(inferSchoolLevel('302')).toBeNull();
  });

  it('returns null for a simple letter "A"', () => {
    expect(inferSchoolLevel('A')).toBeNull();
  });

  // Collège
  it('maps "6e A" to sixieme', () => {
    expect(inferSchoolLevel('6e A')).toBe('sixieme');
  });

  it('maps "6ème B" to sixieme (accent)', () => {
    expect(inferSchoolLevel('6ème B')).toBe('sixieme');
  });

  it('maps "6eme" to sixieme (no accent)', () => {
    expect(inferSchoolLevel('6eme')).toBe('sixieme');
  });

  it('maps "6°" to sixieme', () => {
    expect(inferSchoolLevel('6°')).toBe('sixieme');
  });

  it('maps "3EME1" (uppercase) to troisieme', () => {
    expect(inferSchoolLevel('3EME1')).toBe('troisieme');
  });

  it('maps "5ème B" to cinquieme', () => {
    expect(inferSchoolLevel('5ème B')).toBe('cinquieme');
  });

  it('maps "4ème C" to quatrieme', () => {
    expect(inferSchoolLevel('4ème C')).toBe('quatrieme');
  });

  // Lycée
  it('maps "2NDE3" to seconde', () => {
    expect(inferSchoolLevel('2NDE3')).toBe('seconde');
  });

  it('maps "2de" to seconde', () => {
    expect(inferSchoolLevel('2de')).toBe('seconde');
  });

  it('maps "2nd A" to seconde', () => {
    expect(inferSchoolLevel('2nd A')).toBe('seconde');
  });

  it('maps "seconde B" to seconde', () => {
    expect(inferSchoolLevel('seconde B')).toBe('seconde');
  });

  it('maps "1ere A" to premiere', () => {
    expect(inferSchoolLevel('1ere A')).toBe('premiere');
  });

  it('maps "1ère" to premiere (accent)', () => {
    expect(inferSchoolLevel('1ère')).toBe('premiere');
  });

  it('maps "1re" to premiere', () => {
    expect(inferSchoolLevel('1re')).toBe('premiere');
  });

  it('maps "première" to premiere', () => {
    expect(inferSchoolLevel('première')).toBe('premiere');
  });

  it('maps "TLEG2" to terminale', () => {
    expect(inferSchoolLevel('TLEG2')).toBe('terminale');
  });

  it('maps "Tle G" to terminale', () => {
    expect(inferSchoolLevel('Tle G')).toBe('terminale');
  });

  it('maps "terminale" to terminale', () => {
    expect(inferSchoolLevel('terminale')).toBe('terminale');
  });

  it('maps "term S" to terminale', () => {
    expect(inferSchoolLevel('term S')).toBe('terminale');
  });

  it('maps "Tale" to terminale', () => {
    expect(inferSchoolLevel('Tale')).toBe('terminale');
  });

  // Primary
  it('maps "CP" to cp', () => {
    expect(inferSchoolLevel('CP')).toBe('cp');
  });

  it('maps "CE1" to ce1', () => {
    expect(inferSchoolLevel('CE1')).toBe('ce1');
  });

  it('maps "CE2" to ce2', () => {
    expect(inferSchoolLevel('CE2')).toBe('ce2');
  });

  it('maps "CM1" to cm1', () => {
    expect(inferSchoolLevel('CM1')).toBe('cm1');
  });

  it('maps "CM2" to cm2', () => {
    expect(inferSchoolLevel('CM2')).toBe('cm2');
  });
});

// ============================================
// matchExistingChild
// ============================================

describe('matchExistingChild', () => {
  const children = [
    { id: 'child-1', firstName: 'Emma', lastName: 'Dupont' },
    { id: 'child-2', firstName: 'Lucas', lastName: 'Dupont' },
    { id: 'child-3', firstName: 'Léa', lastName: 'Martin' },
  ];

  it('matches exact case-insensitive name', () => {
    expect(matchExistingChild('Emma Dupont', children)).toBe('child-1');
  });

  it('matches with different casing', () => {
    expect(matchExistingChild('EMMA DUPONT', children)).toBe('child-1');
  });

  it('matches name with accents stripped', () => {
    expect(matchExistingChild('Léa Martin', children)).toBe('child-3');
  });

  it('matches when resource name has accents but stored name does not', () => {
    // Pronote sends "Lea Martin", stored as "Léa Martin" — normalize both
    const childrenWithAccent = [{ id: 'child-3', firstName: 'Léa', lastName: 'Martin' }];
    expect(matchExistingChild('Lea Martin', childrenWithAccent)).toBe('child-3');
  });

  it('returns null when no match', () => {
    expect(matchExistingChild('Sophie Bernard', children)).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(matchExistingChild('Emma Dupont', [])).toBeNull();
  });

  it('handles null firstName/lastName in existing children gracefully', () => {
    const withNulls = [{ id: 'child-x', firstName: null, lastName: null }];
    expect(matchExistingChild('Emma Dupont', withNulls)).toBeNull();
  });

  it('matches with extra spaces in resource name', () => {
    expect(matchExistingChild('  Emma  Dupont  ', children)).toBe('child-1');
  });
});
