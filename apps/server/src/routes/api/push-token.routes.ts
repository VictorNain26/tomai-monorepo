import { Elysia, t } from 'elysia';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { db } from '../../db/connection';
import { logger } from '../../lib/observability';

export const pushTokenApiRoutes = new Elysia({ name: 'api-push-token' })

  .post('/users/push-token', async ({ body, request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const { token, platform, deviceName } = body;

      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        set.status = 400;
        return { error: 'Invalid Expo push token format' };
      }

      const { devicePushTokens } = await import('../../db/schema');

      await db
        .insert(devicePushTokens)
        .values({
          userId: authContext.user.id,
          token,
          platform,
          deviceName: deviceName ?? null,
          isActive: true,
          lastUsedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: devicePushTokens.token,
          set: {
            userId: authContext.user.id,
            platform,
            deviceName: deviceName ?? null,
            isActive: true,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      logger.info('Push token saved', {
        operation: 'api:users:push-token',
        userId: authContext.user.id,
        platform,
        tokenPrefix: token.slice(0, 30),
        severity: 'low' as const
      });

      return { success: true };
    } catch (_error) {
      logger.error('Push token save failed', {
        operation: 'api:users:push-token',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { error: 'Failed to save push token' };
    }
  }, {
    body: t.Object({
      token: t.String({ minLength: 1, maxLength: 200 }),
      platform: t.Union([t.Literal('ios'), t.Literal('android')]),
      deviceName: t.Optional(t.String({ maxLength: 100 })),
    }),
  })

  .delete('/users/push-token', async ({ body, request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const { token } = body;

      const { devicePushTokens } = await import('../../db/schema');
      const { eq, and } = await import('drizzle-orm');

      await db
        .delete(devicePushTokens)
        .where(
          and(
            eq(devicePushTokens.userId, authContext.user.id),
            eq(devicePushTokens.token, token)
          )
        );

      logger.info('Push token deleted', {
        operation: 'api:users:push-token:delete',
        userId: authContext.user.id,
        severity: 'low' as const
      });

      return { success: true };
    } catch (_error) {
      logger.error('Push token delete failed', {
        operation: 'api:users:push-token:delete',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { error: 'Failed to delete push token' };
    }
  }, {
    body: t.Object({
      token: t.String({ minLength: 1, maxLength: 200 }),
    }),
  });
