import { describe, expect, it } from 'bun:test';
import { addressOf } from './client-address';

describe('the client address', () => {
  it('is the connection’s own without a proxy, whatever the client writes', () => {
    expect(addressOf('203.0.113.9', '192.0.2.1', 0)).toBe('192.0.2.1');
  });

  it('is the entry the one proxy appended, behind one', () => {
    expect(addressOf('203.0.113.9', '10.0.0.2', 1)).toBe('203.0.113.9');
  });

  it('ignores the entries a client wrote before the proxy’s', () => {
    expect(addressOf('198.51.100.7, 203.0.113.1, 203.0.113.9', '10.0.0.2', 1)).toBe('203.0.113.9');
    expect(addressOf('198.51.100.7,203.0.113.9', '10.0.0.2', 1)).toBe('203.0.113.9');
  });

  it('counts the hops from the right, behind two proxies', () => {
    expect(addressOf('198.51.100.7, 203.0.113.9, 10.0.0.5', '10.0.0.2', 2)).toBe('203.0.113.9');
  });

  it('is the connection’s own when the proxies’ entry is missing or is not an address', () => {
    expect(addressOf(undefined, '10.0.0.2', 1)).toBe('10.0.0.2');
    expect(addressOf('', '10.0.0.2', 1)).toBe('10.0.0.2');
    expect(addressOf('203.0.113.9', '10.0.0.2', 2)).toBe('10.0.0.2');
    expect(addressOf('not-an-address', '10.0.0.2', 1)).toBe('10.0.0.2');
  });

  it('reads an IPv6 entry', () => {
    expect(addressOf('2001:db8::7', '10.0.0.2', 1)).toBe('2001:db8::7');
  });
});
