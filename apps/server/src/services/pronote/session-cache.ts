import type { ProviderSession } from './provider.types';

const DEFAULT_MAX_SIZE = 1000;

// Entries expire by TTL on access, but maxSize is the hard cap that bounds memory:
// a parent who authenticates once and never returns would otherwise keep an entry
// forever (eviction only happens on an access-after-expiry that never comes).
export class SessionCache<T extends ProviderSession = ProviderSession> {
  private readonly store = new Map<string, { session: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly clock: () => number = Date.now,
    private readonly maxSize: number = DEFAULT_MAX_SIZE,
  ) {}

  get(userId: string): T | null {
    const entry = this.store.get(userId);
    if (!entry) return null;
    if (this.clock() >= entry.expiresAt) {
      this.store.delete(userId);
      return null;
    }
    return entry.session;
  }

  set(userId: string, session: T): void {
    if (!this.store.has(userId) && this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(userId, { session, expiresAt: this.clock() + this.ttlMs });
  }

  delete(userId: string): void {
    this.store.delete(userId);
  }
}
