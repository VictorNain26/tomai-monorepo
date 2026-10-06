import { describe, it, expect, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { checkQuota } from '../modules/billing/quota.js';
import { QUOTA_CONFIG, lastDailyReset } from '../modules/billing/quota-config.js';
import { checkDbReachable } from './_helpers/db';

/**
 * Integration test — quota enforcement is ON by default
 * (QUOTA_ENFORCEMENT_ENABLED defaults to `true` in config/env.ts).
 *
 * The day's spend is read from `cost_tracking` in the migrated DB: a user without a
 * `user_subscriptions` row is on the Gratuit budget, not unlimited.
 */

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('checkQuota (enforcement enabled by default)', () => {
  const stamp = Date.now();
  const studentId = `quota_${stamp}`;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user, costTracking } = await import('../db/schema');
    // cost_tracking keeps its rows when the user goes (set null): remove them first.
    await db.delete(costTracking).where(eq(costTracking.userId, studentId)).catch(() => null);
    await db.delete(user).where(eq(user.id, studentId)).catch(() => null);
  });

  it('gives a brand-new user the Gratuit budget at zero spend', async () => {
    expect(await checkQuota(`new_${stamp}`)).toMatchObject({
      allowed: true, plan: 'free', usage: { spentMicroEur: 0, budgetMicroEur: QUOTA_CONFIG.free.dailyBudgetMicroEur },
    });
  });

  it("sums the user's calls since the last reset, and refuses once the budget is spent", async () => {
    const { db } = await import('../db/connection');
    const { user, costTracking } = await import('../db/schema');
    await db.insert(user).values({ id: studentId, email: `${studentId}@internal.tomai` });
    const today = new Date();
    const yesterday = new Date(lastDailyReset(today).getTime() - 60_000);
    await db.insert(costTracking).values([
      { userId: studentId, aiModel: 'mistral-small-2603', operation: 'chat', costMicroEur: 12_000, createdAt: today },
      { userId: studentId, aiModel: 'voxtral-mini-tts-2603', operation: 'text-to-speech', costMicroEur: 5_000, createdAt: today },
      // Before the reset: yesterday's spend does not count.
      { userId: studentId, aiModel: 'mistral-small-2603', operation: 'chat', costMicroEur: 50_000, createdAt: yesterday },
    ]);
    expect(await checkQuota(studentId)).toMatchObject({ allowed: true, usage: { spentMicroEur: 17_000 } });

    await db.insert(costTracking).values({ userId: studentId, aiModel: 'voxtral-mini-tts-2603', operation: 'text-to-speech', costMicroEur: 3_000, createdAt: today });
    expect(await checkQuota(studentId)).toMatchObject({ allowed: false, usage: { spentMicroEur: 20_000 } });
  });
});
