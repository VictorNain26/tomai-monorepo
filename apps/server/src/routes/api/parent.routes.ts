import { Elysia } from 'elysia';
import { handleParentAuthWithCookies } from '../../middleware/auth.middleware';
import {
  validateSchema,
  isValidationError,
  createChildSchema,
  updateChildSchema
} from '../../schemas/validation';
import { parentService } from '../../services/parent.service';
import { logger } from '../../lib/observability';

export const parentApiRoutes = new Elysia({ name: 'api-parent' })

  .get('/parent/dashboard', async ({ request: { headers }, set }) => {
    const authContext = await handleParentAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const [children, metrics] = await Promise.all([
        parentService.getParentChildren(authContext.user.id),
        parentService.getParentDashboardMetrics(authContext.user.id)
      ]);

      return {
        success: true,
        parent: {
          id: authContext.user.id,
          name: authContext.user.firstName ?? 'Parent'
        },
        children,
        metrics
      };
    } catch (_error) {
      logger.error('Parent dashboard retrieval failed', {
        operation: 'api:parent:dashboard',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Dashboard retrieval failed' };
    }
  })

  .get('/parent/children', async ({ request: { headers }, set }) => {
    const authContext = await handleParentAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const children = await parentService.getParentChildren(authContext.user.id);
      return children;
    } catch (_error) {
      logger.error('Parent children retrieval failed', {
        operation: 'api:parent:children',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Children retrieval failed' };
    }
  })

  .post('/parent/children', async ({ body, request: { headers }, set }) => {
    const authContext = await handleParentAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    logger.info('Child creation request received', {
      operation: 'api:parent:child:request',
      userId: authContext.user.id,
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
        userId: authContext.user.id,
        bodyType: typeof body,
        bodyKeys: body ? Object.keys(body as object) : [],
        validationDetails: validation._error,
        severity: 'medium' as const
      });
      set.status = 400;
      return { _error: 'Validation Error', message: validation._error, details: 'Check request body format' };
    }

    try {
      const child = await parentService.createChild(authContext.user.id, validation.data);
      return { success: true, child, message: 'Child created successfully' };
    } catch (_error) {
      logger.error('Child creation failed', {
        operation: 'api:parent:child:create',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'high' as const
      });
      set.status = 400;
      return { _error: 'Creation failed', message: _error instanceof Error ? _error.message : 'Failed to create child' };
    }
  })

  .patch('/parent/children/:id', async ({ params, body, request: { headers }, set }) => {
    const authContext = await handleParentAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const validation = validateSchema(updateChildSchema, body);
    if (isValidationError(validation)) {
      set.status = 400;
      return { _error: 'Validation Error', message: validation._error };
    }

    try {
      const updateData = {
        ...validation.data,
        dateOfBirth: validation.data.dateOfBirth ? new Date(validation.data.dateOfBirth) : undefined
      };
      const child = await parentService.updateChild(authContext.user.id, params.id, updateData);
      return { success: true, child };
    } catch (_error) {
      logger.error('Child update failed', {
        operation: 'api:parent:child:update',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 400;
      return { _error: 'Update failed', message: _error instanceof Error ? _error.message : 'Failed to update child' };
    }
  })

  .delete('/parent/children/:id', async ({ params, request: { headers }, set }) => {
    const authContext = await handleParentAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      await parentService.deleteChild(authContext.user.id, params.id);
      return { success: true, message: 'Child deleted successfully' };
    } catch (_error) {
      logger.error('Child deletion failed', {
        operation: 'api:parent:child:delete',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 400;
      return { _error: 'Deletion failed', message: _error instanceof Error ? _error.message : 'Failed to delete child' };
    }
  });
