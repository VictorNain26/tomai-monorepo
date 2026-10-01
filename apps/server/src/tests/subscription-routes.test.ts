import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

let signedIn = { id: 'parent-1', role: 'parent' };
mock.module('../platform/auth/session', () => {
  const requireAuth = () => Promise.resolve({ success: true as const, user: signedIn, session: {} });
  return { requireAuth, requireParentRole: requireAuth };
});

const linked = new Set(['parent-1:child-1']);
const isLinked = mock(async (parentId: string, childId: string) => linked.has(`${parentId}:${childId}`));
mock.module('../modules/family/parent-child.repository', () => ({ parentChildRepository: { isLinked } }));

const getFamilyStatus = mock(async (_parentId: string) => ({ plan: 'free', status: 'inactive', billing: null, children: [] }));
mock.module('../modules/family/subscription.service', () => ({ subscriptionService: { getFamilyStatus } }));

const getUsageStats = mock(async (_userId: string) => ({
  windowTokensUsed: 10, windowTokensRemaining: 90, windowLimit: 100, windowUsagePercent: 10, windowRefreshIn: '2h',
  dailyTokensUsed: 10, dailyTokensRemaining: 990, dailyLimit: 1000, dailyUsagePercent: 1, dailyResetsIn: '5h',
  weeklyTokensUsed: 10, totalTokensUsed: 10, totalMessagesCount: 1, plan: 'free' as const,
}));
mock.module('../modules/billing/index', () => ({ getUsageStats }));

const { subscriptionRoutes } = await import('../modules/family/subscription.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>().route('/api/subscriptions', subscriptionRoutes).onError(handleError);

beforeEach(() => {
  signedIn = { id: 'parent-1', role: 'parent' };
  getFamilyStatus.mockClear();
  getUsageStats.mockClear();
});

describe('GET /api/subscriptions/status', () => {
  it("returns the parent's own family status", async () => {
    const res = await app.request('/api/subscriptions/status?parentId=parent-1');

    expect(res.status).toBe(200);
    expect(getFamilyStatus).toHaveBeenCalledWith('parent-1');
  });

  it("refuses another parent's family", async () => {
    const res = await app.request('/api/subscriptions/status?parentId=parent-2');

    expect(res.status).toBe(403);
    expect(getFamilyStatus).not.toHaveBeenCalled();
  });
});

describe('GET /api/subscriptions/usage', () => {
  it("lets a student read their own usage, without a lastResetAt it cannot prove", async () => {
    signedIn = { id: 'child-1', role: 'student' };

    const res = await app.request('/api/subscriptions/usage?userId=child-1');
    const body = await res.json() as { usage: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(body.usage).not.toHaveProperty('lastResetAt');
  });

  it("lets a parent read a linked child's usage", async () => {
    expect((await app.request('/api/subscriptions/usage?userId=child-1')).status).toBe(200);
  });

  it("refuses another student's usage", async () => {
    signedIn = { id: 'child-2', role: 'student' };

    expect((await app.request('/api/subscriptions/usage?userId=child-1')).status).toBe(403);
    expect(getUsageStats).not.toHaveBeenCalled();
  });

  it('answers an unknown id like a forbidden one, so it does not reveal which accounts exist', async () => {
    const res = await app.request('/api/subscriptions/usage?userId=no-such-user');

    expect(res.status).toBe(403);
  });
});
