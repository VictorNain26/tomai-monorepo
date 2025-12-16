/**
 * Learning Routes - Module Entry Point
 *
 * Exports all learning route modules for registration in main app.
 * Original learningRoutes and learningFsrsRoutes names maintained for compatibility.
 */

export { deckRoutes } from './deck.routes';
export { cardRoutes } from './card.routes';
export { fsrsRoutes } from './fsrs.routes';

// Re-export helpers for potential use elsewhere
export { getUserLevel, validateCardContent, subjectLabels } from './helpers';
