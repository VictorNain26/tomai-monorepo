/**
 * Work that runs after its request has answered, such as an email: the request no longer waits
 * for it, so its timing reveals nothing, and the shutdown waits for what is still running.
 */

export function createBackgroundTasks() {
  const running = new Set<Promise<unknown>>();
  return {
    /** The task's failure is its own to report: better-auth logs its tasks' errors. */
    run: (task: Promise<unknown>) => {
      const tracked = task.catch(() => undefined);
      running.add(tracked);
      void tracked.finally(() => running.delete(tracked));
    },
    /** Resolves once every task started so far has settled. */
    settled: async () => {
      await Promise.all(running);
    },
  };
}
