import { describe, expect, it } from 'bun:test';
import { SessionCache } from '../services/pronote/session-cache';

describe('SessionCache', () => {
  it('returns a cached session within TTL and null after expiry', () => {
    let now = 1000;
    const cache = new SessionCache(60_000, () => now);
    cache.set('user1', { token: 't', username: 'u' });
    expect(cache.get('user1')?.token).toBe('t');
    now += 60_001;
    expect(cache.get('user1')).toBeNull();
  });

  it('delete removes an entry', () => {
    const cache = new SessionCache(60_000, () => 0);
    cache.set('user1', { token: 't', username: 'u' });
    cache.delete('user1');
    expect(cache.get('user1')).toBeNull();
  });

  it('evicts the oldest entry once maxSize is exceeded', () => {
    const cache = new SessionCache(60_000, () => 0, 2);
    cache.set('a', { token: 'a', username: 'u' });
    cache.set('b', { token: 'b', username: 'u' });
    cache.set('c', { token: 'c', username: 'u' });
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')?.token).toBe('b');
    expect(cache.get('c')?.token).toBe('c');
  });
});
