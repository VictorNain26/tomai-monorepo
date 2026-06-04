/**
 * Learning Routes - Module Entry Point
 *
 * All learning route groups share the `/api/learning` prefix and are mounted as
 * SIBLINGS here. They must never be nested via `.use()` inside one another:
 * nesting two same-prefix Elysia instances stacks the prefix and yields
 * `/api/learning/api/learning/...` (404 on the real paths). Guarded by
 * src/tests/learning-routes-mount.test.ts.
 */

import { Elysia } from 'elysia';
import { deckRoutes } from './deck.routes';
import { deckDiscoveryRoutes } from './deck-discovery.routes';
import { cardRoutes } from './card.routes';
import { cardGenerateRoutes } from './card-generate.routes';
import { fsrsRoutes } from './fsrs.routes';
import { fsrsExtraRoutes } from './fsrs-extra.routes';

export const learningRoutes = new Elysia({ name: 'learning-routes' })
  .use(deckRoutes)
  .use(deckDiscoveryRoutes)
  .use(cardRoutes)
  .use(cardGenerateRoutes)
  .use(fsrsRoutes)
  .use(fsrsExtraRoutes);

// Re-export helpers for potential use elsewhere
export { getUserLevel, subjectLabels } from './helpers';
