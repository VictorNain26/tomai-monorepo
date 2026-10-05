// Unified schema barrel. Re-exports every domain schema file plus the
// cross-domain relations from ./schema/index.
//
// Bun's test resolver occasionally fails to propagate transitively
// re-exported symbols through two levels of `export *` (schema.ts →
// schema/index.ts → a domain schema file). Re-exporting each subpath directly
// here sidesteps that quirk while keeping a single import entry point for
// consumers.
export * from '../modules/auth/auth.schema';
export * from '../modules/family/family.schema';
export * from '../modules/tutor/session.schema';
export * from '../modules/tutor/exercise-sheet.schema';
export * from '../modules/tutor/distress.schema';
export * from './schema/progress.schema';
export * from '../modules/billing/cost-tracking.schema';
export * from '../modules/billing/billing.schema';
export * from '../modules/documents/files.schema';
export * from '../modules/learning/decks.schema';
export {
  userRelations,
  studySessionsRelations,
  type UserWithRelations,
} from './schema/index';
