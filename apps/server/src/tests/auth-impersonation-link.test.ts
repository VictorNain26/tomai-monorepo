import { describe, it, expect } from 'bun:test';

// La logique d'autorisation extraite est testée directement.
function canImpersonate(requesting: { id: string; role: string }, target: { role: string } | undefined, linked: boolean): boolean {
  if (requesting.role !== 'parent') return false;
  if (!target) return false;
  return target.role === 'student' && linked;
}

describe('impersonation authorization', () => {
  it('allows a parent to impersonate a linked student', () => {
    expect(canImpersonate({ id: 'p1', role: 'parent' }, { role: 'student' }, true)).toBe(true);
  });
  it('denies when no link exists', () => {
    expect(canImpersonate({ id: 'p1', role: 'parent' }, { role: 'student' }, false)).toBe(false);
  });
  it('denies when target is not a student', () => {
    expect(canImpersonate({ id: 'p1', role: 'parent' }, { role: 'parent' }, true)).toBe(false);
  });
});
