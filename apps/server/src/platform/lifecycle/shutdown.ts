/**
 * Graceful shutdown: readiness fails first, and stays failed for `drainMs`, long enough for the
 * host's probe to see it and stop routing here; then the server stops taking connections and
 * waits for the requests in flight (https://bun.com/docs/runtime/http/server), then the
 * resources close. Past the deadline the process exits anyway, before the host's grace period.
 */

import type { Logger } from 'pino';

export interface Lifecycle {
  draining: boolean;
}

export function createLifecycle(): Lifecycle {
  return { draining: false };
}

interface ShutdownDeps {
  lifecycle: Lifecycle;
  stopServer: () => Promise<void>;
  close: (() => Promise<void>)[];
  logger: Logger;
  drainMs: number;
  deadlineMs: number;
}

/** Resolves with the exit code: 0 once everything closed, 1 on an error or past the deadline. */
export async function shutdown({ lifecycle, stopServer, close, logger, drainMs, deadlineMs }: ShutdownDeps): Promise<number> {
  lifecycle.draining = true;
  let timer: Timer | undefined;
  const deadline = new Promise<number>((resolve) => {
    timer = setTimeout(() => {
      logger.error({ deadlineMs }, 'Shutdown deadline reached');
      resolve(1);
    }, deadlineMs);
  });
  const graceful = (async () => {
    await Bun.sleep(drainMs);
    await stopServer();
    await Promise.all(close.map((fn) => fn()));
    return 0;
  })().catch((error: unknown) => {
    logger.error({ err: error }, 'Shutdown failed');
    return 1;
  });
  const code = await Promise.race([graceful, deadline]);
  clearTimeout(timer);
  return code;
}
