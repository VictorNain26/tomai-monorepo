import { describe, it, expect } from 'bun:test';
import { canParentImpersonate } from '../lib/impersonation-policy';

describe('impersonation authorization', () => {
  it('allows a parent to impersonate a linked student', () => {
    expect(canParentImpersonate('parent', 'student', true)).toBe(true);
  });
  it('denies when no link exists', () => {
    expect(canParentImpersonate('parent', 'student', false)).toBe(false);
  });
  it('denies when target is not a student', () => {
    expect(canParentImpersonate('parent', 'parent', true)).toBe(false);
  });
  it('denies when requester is not a parent', () => {
    expect(canParentImpersonate('student', 'student', true)).toBe(false);
  });
});
