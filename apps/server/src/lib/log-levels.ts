/** Single source for LOG_LEVEL: validated by config/env.ts, applied by lib/observability.ts. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
