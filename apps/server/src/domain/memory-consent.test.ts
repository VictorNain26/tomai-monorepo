import { describe, expect, it } from 'bun:test';
import { ageAt, memoryState } from './memory-consent';

const now = new Date('2026-10-07T12:00:00Z');
const fourteen = '2012-03-01';
const fifteen = '2011-10-01';

describe('ageAt', () => {
  it('counts a birthday from the first day of its month', () => {
    expect(ageAt('2011-10-01', now)).toBe(15);
    expect(ageAt('2011-11-01', now)).toBe(14);
    expect(ageAt('2012-03-01', now)).toBe(14);
  });
});

describe('memoryState', () => {
  it('before 15, asks the child only once the parent proposed it, and is active once the child accepts', () => {
    expect(memoryState({ birthMonth: fourteen, proposedAt: null, answer: null }, now)).toBe('off');
    expect(memoryState({ birthMonth: fourteen, proposedAt: now, answer: null }, now)).toBe('asked');
    expect(memoryState({ birthMonth: fourteen, proposedAt: now, answer: 'accepted' }, now)).toBe('active');
  });

  it('before 15, stays off when the parent withdraws it, whatever the child answered', () => {
    expect(memoryState({ birthMonth: fourteen, proposedAt: null, answer: 'accepted' }, now)).toBe('off');
  });

  it('from 15, lets the child decide alone', () => {
    expect(memoryState({ birthMonth: fifteen, proposedAt: null, answer: null }, now)).toBe('asked');
    expect(memoryState({ birthMonth: fifteen, proposedAt: null, answer: 'accepted' }, now)).toBe('active');
  });

  it('is off once the child declines, at any age', () => {
    expect(memoryState({ birthMonth: fourteen, proposedAt: now, answer: 'declined' }, now)).toBe('off');
    expect(memoryState({ birthMonth: fifteen, proposedAt: now, answer: 'declined' }, now)).toBe('off');
  });
});
