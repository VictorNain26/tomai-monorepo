/**
 * Learning Routes - Module Entry Point
 *
 * Every learning route requires a signed-in user: the guard is applied once
 * here, and app.ts mounts this module under /api/learning only.
 */

import { Hono } from 'hono';
import { requireUser, type AppEnv } from '../../lib/http.js';
import { deckRoutes } from './deck.routes';
import { deckDiscoveryRoutes } from './deck-discovery.routes';
import { cardRoutes } from './card.routes';
import { cardGenerateRoutes } from './card-generate.routes';
import { fsrsRoutes } from './fsrs.routes';
import { fsrsExtraRoutes } from './fsrs-extra.routes';

export const learningRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .route('/', deckRoutes)
  .route('/', deckDiscoveryRoutes)
  .route('/', cardRoutes)
  .route('/', cardGenerateRoutes)
  .route('/', fsrsRoutes)
  .route('/', fsrsExtraRoutes);
