import { describe, it, expect, mock } from 'bun:test';

const listChildren = mock(async (_parentId: string, _options?: { includeInactive?: boolean }) => [
  { id: 'c1', name: 'Léa Martin', username: 'lea' },
  { id: 'c2', name: 'Tom Martin', username: 'tom' },
]);
mock.module('../modules/family/children', () => ({ listChildren }));
mock.module('../modules/billing/index', () => ({
  subscriptionRepository: {
    findFamilyBilling: mock(async () => undefined),
    findChildSubscriptions: mock(async () => [{ userId: 'c2', planName: 'premium', status: 'active' }]),
  },
}));

const { subscriptionService } = await import('../modules/family/subscription.service');

describe('subscriptionService.getFamilyStatus', () => {
  it('lists every child, deactivated ones included, with their plan', async () => {
    const status = await subscriptionService.getFamilyStatus('p1');

    expect(listChildren).toHaveBeenCalledWith('p1', { includeInactive: true });
    expect(status.children).toEqual([
      { id: 'c1', name: 'Léa Martin', username: 'lea', plan: 'free', status: 'inactive' },
      { id: 'c2', name: 'Tom Martin', username: 'tom', plan: 'premium', status: 'active' },
    ]);
  });
});
