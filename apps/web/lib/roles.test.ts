import { describe, it, expect } from 'vitest';
import { ROLE_HOME, ROLES } from './roles';

describe('roles', () => {
  it('maps every role to a home path', () => {
    for (const role of ROLES) {
      expect(ROLE_HOME[role]).toBe(`/${role}`);
    }
  });
});
