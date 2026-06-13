/**
 * Push Tokens Repository - Data-access for device_push_tokens.
 *
 * One method = one typed Drizzle query.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../connection';
import { devicePushTokens } from '../schema';

interface UpsertPushTokenInput {
  userId: string;
  token: string;
  platform: 'ios' | 'android';
  deviceName: string | null;
}

class PushTokensRepository {
  /**
   * Register (or refresh) a device push token. Keyed on the token itself, so a
   * token that moves to another user/device is re-pointed rather than duplicated.
   */
  async upsert(input: UpsertPushTokenInput): Promise<void> {
    const now = new Date();
    await db
      .insert(devicePushTokens)
      .values({
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        deviceName: input.deviceName,
        isActive: true,
        lastUsedAt: now,
      })
      .onConflictDoUpdate({
        target: devicePushTokens.token,
        set: {
          userId: input.userId,
          platform: input.platform,
          deviceName: input.deviceName,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        },
      });
  }

  /** Remove a token owned by the given user (no-op if it isn't theirs). */
  async deleteByUserAndToken(userId: string, token: string): Promise<void> {
    await db
      .delete(devicePushTokens)
      .where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.token, token)));
  }
}

export const pushTokensRepository = new PushTokensRepository();
