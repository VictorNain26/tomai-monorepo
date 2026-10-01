// Unified schema barrel. Re-exports every domain schema file plus the
// cross-domain relations from ./schema/index.
//
// Bun's test resolver occasionally fails to propagate transitively
// re-exported symbols through two levels of `export *` (schema.ts →
// schema/index.ts → a domain schema file). Re-exporting each subpath directly
// here sidesteps that quirk while keeping a single import entry point for
// consumers.
export * from './schema/auth.schema';
export * from '../modules/tutor/session.schema';
export * from './schema/progress.schema';
export * from './schema/cost-tracking.schema';
export * from './schema/billing.schema';
export * from '../modules/documents/files.schema';
export * from '../modules/learning/decks.schema';
export * from '../modules/tutor/cognitive-profile.schema';
export {
  userRelations,
  studySessionsRelations,
  type UserWithRelations,
} from './schema/index';
