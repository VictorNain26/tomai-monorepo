import { Hono } from 'hono';
import type { AppEnv } from '../../platform/http/context.js';
import { apiHealthRoutes } from './health.routes';
import { chatSessionApiRoutes } from './chat-session.routes';
import { parentApiRoutes } from './parent.routes';
import { educationApiRoutes } from './education.routes';
import { progressApiRoutes } from './progress.routes';
import { studentApiRoutes } from './student.routes';

// Each route carries its own auth guard: a `use()` here would apply to every
// /api/* route, public ones included.
const api = new Hono<AppEnv>()
  .route('/', chatSessionApiRoutes)
  .route('/', parentApiRoutes)
  .route('/', educationApiRoutes)
  .route('/', progressApiRoutes)
  .route('/', studentApiRoutes);

// Mounted at root (not under /api): GET /health is the single canonical
// health endpoint, polled by the Dockerfile HEALTHCHECK.
export const apiRoutes = new Hono<AppEnv>()
  .route('/', apiHealthRoutes)
  .route('/api', api);
