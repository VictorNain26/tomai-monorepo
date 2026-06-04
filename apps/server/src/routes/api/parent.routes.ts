import { Elysia } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import {
  validateSchema,
  isValidationError,
  createChildSchema,
  updateChildSchema
} from '../../schemas/validation';
import { parentService } from '../../services/parent.service';
import { logger } from '../../lib/observability';

export const parentApiRoutes = new Elysia({ name: 'api-parent' })
  .use(authMacro)
  .guard({ parentAuth: true })

  .get('/parent/dashboard', async ({ user, status }) => {
    try {
      const [children, metrics] = await Promise.all([
        parentService.getParentChildren(user.id),
        parentService.getParentDashboardMetrics(user.id)
      ]);

      return {
        success: true,
        parent: {
          id: user.id,
          name: user.firstName ?? 'Parent'
        },
        children,
        metrics
      };
    } catch (_error) {
      logger.error('Parent dashboard retrieval failed', {
        operation: 'api:parent:dashboard',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(500, { _error: 'Dashboard retrieval failed' });
    }
  })

  .get('/parent/children', async ({ user, status }) => {
    try {
      const children = await parentService.getParentChildren(user.id);
      return children;
    } catch (_error) {
      logger.error('Parent children retrieval failed', {
        operation: 'api:parent:children',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(500, { _error: 'Children retrieval failed' });
    }
  })

  .post('/parent/children', async ({ body, user, status }) => {
    logger.info('Child creation request received', {
      operation: 'api:parent:child:request',
      userId: user.id,
      bodyType: typeof body,
      bodyKeys: body ? Object.keys(body as object) : [],
      contentLength: JSON.stringify(body).length,
      severity: 'low' as const
    });

    const validation = validateSchema(createChildSchema, body);
    if (isValidationError(validation)) {
      logger.error('Child creation validation failed', {
        _error: validation._error,
        operation: 'api:parent:child:validation',
        userId: user.id,
        bodyType: typeof body,
        bodyKeys: body ? Object.keys(body as object) : [],
        validationDetails: validation._error,
        severity: 'medium' as const
      });
      return status(400, { _error: 'Validation Error', message: validation._error, details: 'Check request body format' });
    }

    try {
      const child = await parentService.createChild(user.id, validation.data);
      return { success: true, child, message: 'Child created successfully' };
    } catch (_error) {
      logger.error('Child creation failed', {
        operation: 'api:parent:child:create',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'high' as const
      });
      return status(400, { _error: 'Creation failed', message: _error instanceof Error ? _error.message : 'Failed to create child' });
    }
  })

  .patch('/parent/children/:id', async ({ params, body, user, status, request: { headers } }) => {
    const validation = validateSchema(updateChildSchema, body);
    if (isValidationError(validation)) {
      return status(400, { _error: 'Validation Error', message: validation._error });
    }

    try {
      const child = await parentService.updateChild(user.id, params.id, validation.data, headers);
      return { success: true, child };
    } catch (_error) {
      logger.error('Child update failed', {
        operation: 'api:parent:child:update',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(400, { _error: 'Update failed', message: _error instanceof Error ? _error.message : 'Failed to update child' });
    }
  })

  .delete('/parent/children/:id', async ({ params, user, status }) => {
    try {
      await parentService.deleteChild(user.id, params.id);
      return { success: true, message: 'Child deleted successfully' };
    } catch (_error) {
      logger.error('Child deletion failed', {
        operation: 'api:parent:child:delete',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(400, { _error: 'Deletion failed', message: _error instanceof Error ? _error.message : 'Failed to delete child' });
    }
  });
