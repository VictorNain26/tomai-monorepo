import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { pushTokensRepository } from '../../db/repositories/push-tokens.repository';
import { logger } from '../../lib/observability';

export const pushTokenApiRoutes = new Elysia({ name: 'api-push-token' })
  .use(authMacro)

  .guard({ auth: true })
  .post('/users/push-token', async ({ body, user, status }) => {
    try {
      const { token, platform, deviceName } = body;

      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        return status(400, { error: 'Invalid Expo push token format' });
      }

      await pushTokensRepository.upsert({
        userId: user.id,
        token,
        platform,
        deviceName: deviceName ?? null,
      });

      logger.info('Push token saved', {
        operation: 'api:users:push-token',
        userId: user.id,
        platform,
        tokenPrefix: token.slice(0, 30),
        severity: 'low' as const
      });

      return { success: true };
    } catch (_error) {
      logger.error('Push token save failed', {
        operation: 'api:users:push-token',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(500, { error: 'Failed to save push token' });
    }
  }, {
    body: t.Object({
      token: t.String({ minLength: 1, maxLength: 200 }),
      platform: t.Union([t.Literal('ios'), t.Literal('android')]),
      deviceName: t.Optional(t.String({ maxLength: 100 })),
    }),
  })

  .delete('/users/push-token', async ({ body, user, status }) => {
    try {
      await pushTokensRepository.deleteByUserAndToken(user.id, body.token);

      logger.info('Push token deleted', {
        operation: 'api:users:push-token:delete',
        userId: user.id,
        severity: 'low' as const
      });

      return { success: true };
    } catch (_error) {
      logger.error('Push token delete failed', {
        operation: 'api:users:push-token:delete',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(500, { error: 'Failed to delete push token' });
    }
  }, {
    body: t.Object({
      token: t.String({ minLength: 1, maxLength: 200 }),
    }),
  });
