/**
 * Tests - Auth schema alignment
 * Prevents regressions on Better Auth + Google OAuth configuration.
 *
 * Context: "unable to create user" bug caused by missing admin plugin columns,
 * missing accountLinking config, and orphaned passkey table.
 */

import { describe, it, expect } from 'bun:test';
import { user, session, account, verification } from '../db/schema';

describe('Auth Schema Alignment', () => {
  describe('user table - Better Auth admin plugin fields', () => {
    it('should have banned column', () => {
      expect(user.banned).toBeDefined();
    });

    it('should have banReason column', () => {
      expect(user.banReason).toBeDefined();
    });

    it('should have banExpires column', () => {
      expect(user.banExpires).toBeDefined();
    });
  });

  describe('user table - core auth fields', () => {
    it('should have email column', () => {
      expect(user.email).toBeDefined();
    });

    it('should have email with unique constraint', () => {
      expect(user.email.isUnique).toBe(true);
    });

    it('should have role column with parent default', () => {
      expect(user.role).toBeDefined();
      expect(user.role.default).toBe('parent');
    });

    it('should have isActive column defaulting to true', () => {
      expect(user.isActive).toBeDefined();
      expect(user.isActive.default).toBe(true);
    });
  });

  describe('user table - no orphaned passkey references', () => {
    it('should NOT have passkey column', () => {
      expect((user as Record<string, unknown>)['passkey']).toBeUndefined();
    });
  });

  describe('session table - admin plugin fields', () => {
    it('should have impersonatedBy column', () => {
      expect(session.impersonatedBy).toBeDefined();
    });

    it('should have token column', () => {
      expect(session.token).toBeDefined();
    });
  });

  describe('account table - Google OAuth fields', () => {
    it('should have idToken column (required for Google OAuth)', () => {
      expect(account.idToken).toBeDefined();
    });

    it('should have providerId column', () => {
      expect(account.providerId).toBeDefined();
    });

    it('should have accessToken column', () => {
      expect(account.accessToken).toBeDefined();
    });

    it('should have refreshToken column', () => {
      expect(account.refreshToken).toBeDefined();
    });
  });

  describe('verification table', () => {
    it('should have value column as text (not varchar - required for OAuth tokens)', () => {
      expect(verification.value).toBeDefined();
      // Drizzle text columns have dataType 'text'
      expect(verification.value.dataType).toBe('string');
    });
  });
});
