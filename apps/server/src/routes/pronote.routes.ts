import { Elysia } from 'elysia';
import { pronotePublicRoutes } from './pronote/pronote-public.routes.js';
import { pronoteParentRoutes } from './pronote/pronote-parent.routes.js';
import { pronoteStudentRoutes } from './pronote/pronote-student.routes.js';

// Re-export individual route groups
export { pronoteParentRoutes } from './pronote/pronote-parent.routes.js';
export { pronoteStudentRoutes } from './pronote/pronote-student.routes.js';
export { pronotePublicRoutes } from './pronote/pronote-public.routes.js';

// Combined routes for app registration
export const pronoteRoutes = new Elysia()
  .use(pronotePublicRoutes)
  .use(pronoteParentRoutes)
  .use(pronoteStudentRoutes);
