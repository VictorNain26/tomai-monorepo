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

const checkQuota = mock(async (_userId: string) => ({
  allowed: true, plan: 'free' as const, spentMicroEur: 5_000, budgetMicroEur: 20_000, usagePercent: 25, resetsIn: '5h',
}));
mock.module('../modules/billing/index', () => ({ checkQuota }));

const { subscriptionRoutes } = await import('../modules/family/subscription.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>().route('/api/subscriptions', subscriptionRoutes).onError(handleError);

beforeEach(() => {
  signedIn = { id: 'parent-1', role: 'parent' };
  getFamilyStatus.mockClear();
  checkQuota.mockClear();
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
  it("lets a student read their own day: what was spent against the plan's budget", async () => {
    signedIn = { id: 'child-1', role: 'student' };

    const res = await app.request('/api/subscriptions/usage?userId=child-1');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId: 'child-1', plan: 'free', daily: { spentMicroEur: 5_000, budgetMicroEur: 20_000, usagePercent: 25, resetsIn: '5h' },
    });
  });

  it("lets a parent read a linked child's usage", async () => {
    expect((await app.request('/api/subscriptions/usage?userId=child-1')).status).toBe(200);
  });

  it("refuses another student's usage", async () => {
    signedIn = { id: 'child-2', role: 'student' };

    expect((await app.request('/api/subscriptions/usage?userId=child-1')).status).toBe(403);
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it('answers an unknown id like a forbidden one, so it does not reveal which accounts exist', async () => {
    const res = await app.request('/api/subscriptions/usage?userId=no-such-user');

    expect(res.status).toBe(403);
  });
});
