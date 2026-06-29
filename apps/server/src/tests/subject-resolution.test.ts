import { describe, it, expect } from 'bun:test';
import { resolveEffectiveSubject, shouldPersistDetectedSubject } from '../services/chat/subject-resolution.js';

describe('resolveEffectiveSubject', () => {
  it('prefers a confident detected subject', () => {
    expect(resolveEffectiveSubject({ detected: 'mathematiques', sessionSubject: 'général' })).toBe('mathematiques');
  });
  it('falls back to the session subject when detection is general', () => {
    expect(resolveEffectiveSubject({ detected: 'general', sessionSubject: 'francais' })).toBe('francais');
  });
  it('falls back to the requested hint when nothing else is set', () => {
    expect(resolveEffectiveSubject({ detected: 'general', sessionSubject: 'général', requested: 'svt' })).toBe('svt');
  });
  it('returns undefined when nothing resolves', () => {
    expect(resolveEffectiveSubject({ detected: 'general', sessionSubject: 'général' })).toBeUndefined();
  });
});

describe('shouldPersistDetectedSubject', () => {
  it('persists a confident detection over the default session subject', () => {
    expect(shouldPersistDetectedSubject({ detected: 'mathematiques', sessionSubject: 'général' })).toBe(true);
  });
  it('does not persist when the session already has a real subject', () => {
    expect(shouldPersistDetectedSubject({ detected: 'mathematiques', sessionSubject: 'francais' })).toBe(false);
  });
  it("does not persist a 'general' detection", () => {
    expect(shouldPersistDetectedSubject({ detected: 'general', sessionSubject: 'général' })).toBe(false);
  });
});
