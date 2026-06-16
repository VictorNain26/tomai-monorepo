import type { ProviderSession } from './provider.types';

// TODO: add max-size eviction if the parent count grows (entries are only evicted on access-after-expiry)
export class SessionCache<T extends ProviderSession = ProviderSession> {
  private readonly store = new Map<string, { session: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly clock: () => number = Date.now,
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
    this.store.set(userId, { session, expiresAt: this.clock() + this.ttlMs });
  }

  delete(userId: string): void {
    this.store.delete(userId);
  }
}
