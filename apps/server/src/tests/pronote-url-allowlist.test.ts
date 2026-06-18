/**
 * Tests — assertAllowedPronoteUrl
 *
 * C1 (SSRF): validates that only HTTPS index-education.net URLs are accepted,
 * and that loopback, private, link-local, and arbitrary external URLs are rejected.
 */

import { describe, it, expect } from 'bun:test';
import {
  assertAllowedPronoteUrl,
  PronoteUrlNotAllowedError,
} from '../lib/pronote-url-allowlist';

describe('assertAllowedPronoteUrl', () => {
  // =====================
  // Valid URLs
  // =====================

  it('accepts a canonical index-education.net HTTPS URL', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://0131923v.index-education.net/pronote/'),
    ).not.toThrow();
  });

  it('accepts any subdomain of index-education.net over HTTPS', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://demo.index-education.net/pronote/'),
    ).not.toThrow();
  });

  it('accepts the bare hostname index-education.net over HTTPS', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://index-education.net/'),
    ).not.toThrow();
  });

  it('accepts a URL object as well as a string', () => {
    expect(() =>
      assertAllowedPronoteUrl(new URL('https://school.index-education.net/pronote')),
    ).not.toThrow();
  });

  // =====================
  // Protocol rejections
  // =====================

  it('rejects http:// URLs even for index-education.net', () => {
    expect(() =>
      assertAllowedPronoteUrl('http://0131923v.index-education.net/pronote/'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects http:// localhost', () => {
    expect(() => assertAllowedPronoteUrl('http://localhost/')).toThrow(PronoteUrlNotAllowedError);
  });

  // =====================
  // Private / loopback / link-local rejections
  // =====================

  it('rejects link-local address 169.254.x.x', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://169.254.169.254/latest/meta-data/'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects loopback 127.0.0.1', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://127.0.0.1/evil'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects "localhost" hostname', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://localhost/secret'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects 10.x.x.x private range', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://10.0.0.1/internal'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects 172.16.x.x private range', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://172.16.0.1/internal'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects 172.31.x.x private range (upper bound)', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://172.31.255.255/internal'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects 192.168.x.x private range', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://192.168.1.1/router'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects IPv6 loopback ::1', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://[::1]/secret'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects 0.0.0.0', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://0.0.0.0/'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  // =====================
  // External domain rejections
  // =====================

  it('rejects an arbitrary external domain', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://evil.com/exfiltrate'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects a domain that superficially contains index-education.net but is not a subdomain', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://evil-index-education.net/'),
    ).toThrow(PronoteUrlNotAllowedError);
  });

  it('rejects postgres port on localhost', () => {
    expect(() =>
      assertAllowedPronoteUrl('https://localhost:5432/'),
    ).toThrow(PronoteUrlNotAllowedError);
  });
});
