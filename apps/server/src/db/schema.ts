// Unified schema barrel. Re-exports every domain schema file plus the
// cross-domain relations from ./schema/index.
//
// Bun's test resolver occasionally fails to propagate transitively
// re-exported symbols through two levels of `export *` (schema.ts →
// schema/index.ts → learning.schema.ts). Re-exporting each subpath directly
// here sidesteps that quirk while keeping a single import entry point for
// consumers.
export * from './schema/auth.schema';
export * from './schema/learning.schema';
export * from './schema/pronote.schema';
export * from './schema/billing.schema';
export * from './schema/files.schema';
export * from './schema/learning-tools.schema';
export {
  userRelations,
  studySessionsRelations,
  type UserWithRelations,
} from './schema/index';
