import { logger } from './observability.js';

export interface ShutdownStep {
  name: string;
  run: () => void | Promise<unknown>;
}

export function createGracefulShutdown(
  steps: ShutdownStep[],
  exit: (code: number) => void,
): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received - shutting down gracefully`, { operation: 'server:shutdown', signal });

    for (const step of steps) {
      try {
        await step.run();
      } catch (err) {
        logger.error(`Shutdown step failed: ${step.name}`, {
          operation: 'server:shutdown',
          _error: err instanceof Error ? err.message : String(err),
          severity: 'high' as const,
        });
      }
    }

    logger.info('Shutdown completed', { operation: 'server:shutdown' });
    exit(0);
  };
}
