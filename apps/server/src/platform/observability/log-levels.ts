/** Single source for LOG_LEVEL: validated by platform/config/env.ts, applied by platform/observability/logger.ts. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
