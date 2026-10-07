import { describe, expect, it } from 'bun:test';
import { ageAt, memoryConsent } from './memory-consent';

const now = new Date('2026-10-07T12:00:00Z');
const fourteen = '2012-03-01';
const fifteen = '2011-09-01';

describe('ageAt', () => {
  it('counts a birthday at the end of its month, never early', () => {
    expect(ageAt('2011-09-01', now)).toBe(15);
    // Born in October 2011: maybe on the 28th, so not 15 before November.
    expect(ageAt('2011-10-01', now)).toBe(14);
    expect(ageAt('2011-10-01', new Date('2026-11-01T00:00:00Z'))).toBe(15);
    expect(ageAt('2012-03-01', now)).toBe(14);
  });
});

describe('memoryConsent', () => {
  it('before 15, asks the child only once the parent proposed it, and is active once the child accepts', () => {
    expect(memoryConsent({ birthMonth: fourteen, proposedAt: null, answer: null }, now)).toEqual({
      state: 'off',
      mayAnswer: false,
      decidesAlone: false,
    });
    expect(memoryConsent({ birthMonth: fourteen, proposedAt: now, answer: null }, now)).toEqual({
      state: 'asked',
      mayAnswer: true,
      decidesAlone: false,
    });
    expect(memoryConsent({ birthMonth: fourteen, proposedAt: now, answer: 'accepted' }, now).state).toBe('active');
  });

  it('before 15, stays off when the parent withdraws it, whatever the child answered', () => {
    expect(memoryConsent({ birthMonth: fourteen, proposedAt: null, answer: 'accepted' }, now).state).toBe('off');
  });

  it('from 15, lets the child decide alone', () => {
    expect(memoryConsent({ birthMonth: fifteen, proposedAt: null, answer: null }, now)).toEqual({
      state: 'asked',
      mayAnswer: true,
      decidesAlone: true,
    });
    expect(memoryConsent({ birthMonth: fifteen, proposedAt: null, answer: 'accepted' }, now).state).toBe('active');
  });

  it('is off once the child declines, at any age', () => {
    expect(memoryConsent({ birthMonth: fourteen, proposedAt: now, answer: 'declined' }, now).state).toBe('off');
    expect(memoryConsent({ birthMonth: fifteen, proposedAt: now, answer: 'declined' }, now).state).toBe('off');
  });
});
