import { Hono } from 'hono';
import { z } from 'zod';
import { requireParent, validate, type AppEnv } from '../../platform/http/context.js';
import { createChildSchema, updateChildSchema } from './parent.validation';
import { parentService } from './parent.service';
import { logger } from '../../platform/observability/logger';

const childParams = z.object({ id: z.string().min(1) });

export const parentRoutes = new Hono<AppEnv>()

  .get('/parent/dashboard', requireParent, async (c) => {
    const user = c.var.user;
    try {
      const children = await parentService.getParentChildren(user.id);
      const metrics = await parentService.getParentDashboardMetrics(user.id, children);

      return c.json({
        success: true,
        parent: {
          id: user.id,
          name: user.firstName ?? 'Parent',
        },
        children,
        metrics,
      });
    } catch (_error) {
      logger.error('Parent dashboard retrieval failed', {
        operation: 'api:parent:dashboard',
        userId: user.id,
        err: _error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Dashboard retrieval failed' }, 500);
    }
  })

  .get('/parent/children', requireParent, async (c) => {
    const user = c.var.user;
    try {
      const children = await parentService.getParentChildren(user.id);
      return c.json(children);
    } catch (_error) {
      logger.error('Parent children retrieval failed', {
        operation: 'api:parent:children',
        userId: user.id,
        err: _error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Children retrieval failed' }, 500);
    }
  })

  .post('/parent/children', requireParent, validate('json', createChildSchema), async (c) => {
    const user = c.var.user;
    const body = c.req.valid('json');
    logger.info('Child creation request received', {
      operation: 'api:parent:child:request',
      userId: user.id,
      bodyKeys: Object.keys(body),
      severity: 'low' as const,
    });

    try {
      const child = await parentService.createChild(user.id, body);
      return c.json({ success: true, child, message: 'Child created successfully' });
    } catch (_error) {
      logger.error('Child creation failed', {
        operation: 'api:parent:child:create',
        userId: user.id,
        err: _error,
        severity: 'high' as const,
      });
      return c.json({ error: 'Creation failed', message: _error instanceof Error ? _error.message : 'Failed to create child' }, 400);
    }
  })

  .patch('/parent/children/:id', requireParent, validate('param', childParams), validate('json', updateChildSchema), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    const body = c.req.valid('json');
    try {
      const child = await parentService.updateChild(user.id, params.id, body);
      return c.json({ success: true, child });
    } catch (_error) {
      logger.error('Child update failed', {
        operation: 'api:parent:child:update',
        userId: user.id,
        err: _error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Update failed', message: _error instanceof Error ? _error.message : 'Failed to update child' }, 400);
    }
  })

  .delete('/parent/children/:id', requireParent, validate('param', childParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      await parentService.deleteChild(user.id, params.id);
      return c.json({ success: true, message: 'Child deleted successfully' });
    } catch (_error) {
      logger.error('Child deletion failed', {
        operation: 'api:parent:child:delete',
        userId: user.id,
        err: _error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Deletion failed', message: _error instanceof Error ? _error.message : 'Failed to delete child' }, 400);
    }
  });
