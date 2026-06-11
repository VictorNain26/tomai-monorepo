import { describe, it, expect } from 'vitest';
import { ROLE_HOME, ROLES, asRole, resolveWebRole } from './roles';

describe('roles', () => {
  it('maps every role to a home path', () => {
    for (const role of ROLES) {
      expect(ROLE_HOME[role]).toBe(`/${role}`);
    }
  });
});

describe('asRole', () => {
  it('accepts the three web roles', () => {
    for (const role of ROLES) {
      expect(asRole(role)).toBe(role);
    }
  });

  it('rejects non-web and malformed values', () => {
    expect(asRole('admin')).toBeNull();
    expect(asRole('superadmin')).toBeNull();
    expect(asRole(undefined)).toBeNull();
    expect(asRole(42)).toBeNull();
  });
});

describe('resolveWebRole', () => {
  it('defaults an absent role to parent', () => {
    expect(resolveWebRole(undefined)).toBe('parent');
  });

  it('returns null for a present but non-web role (admin)', () => {
    expect(resolveWebRole('admin')).toBeNull();
  });

  it('passes web roles through', () => {
    expect(resolveWebRole('student')).toBe('student');
  });
});
