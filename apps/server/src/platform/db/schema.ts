/**
 * The platform's tables, for Drizzle's client and drizzle-kit. A module's tables live in its own
 * schema.ts, which drizzle-kit reads too (drizzle.config.ts): platform imports no module.
 */
export * from '../ai/schema';
export * from '../auth/schema';
