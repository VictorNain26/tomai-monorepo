/**
 * SSRF guard for Pronote URLs.
 *
 * All outbound fetch calls from the Pronote adapter must pass through
 * assertAllowedPronoteUrl before executing. The guard prevents server-side
 * request forgery by restricting destinations to the official Pronote domain
 * over HTTPS only.
 */

export class PronoteUrlNotAllowedError extends Error {
  constructor(reason: string) {
    super(`Pronote URL not allowed: ${reason}`);
    this.name = 'PronoteUrlNotAllowedError';
  }
}

// Regex for private/reserved IPv4 ranges + loopback + link-local.
// Matches: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, 0.0.0.0
const PRIVATE_IPV4 = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0)$/;

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();

  if (h === 'localhost') return true;
  if (h === '::1') return true;
  if (h === '[::1]') return true;

  // Strip brackets from IPv6 as URL.hostname includes them
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;
  if (bare === '::1') return true;

  if (PRIVATE_IPV4.test(h)) return true;

  return false;
}

function isAllowedPronoteHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'index-education.net' || h.endsWith('.index-education.net');
}

export function assertAllowedPronoteUrl(rawUrl: string | URL): void {
  let parsed: URL;
  try {
    parsed = typeof rawUrl === 'string' ? new URL(rawUrl) : rawUrl;
  } catch {
    throw new PronoteUrlNotAllowedError('malformed URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new PronoteUrlNotAllowedError(`protocol must be https, got ${parsed.protocol}`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new PronoteUrlNotAllowedError(`hostname is a loopback or private address: ${parsed.hostname}`);
  }

  if (!isAllowedPronoteHostname(parsed.hostname)) {
    throw new PronoteUrlNotAllowedError(`hostname not in Pronote allowlist: ${parsed.hostname}`);
  }
}
