/**
 * A real server behind the real fetch, for the Mistral SDK: its timeouts and retries reach it
 * as they reach Mistral. A mocked fetch does not get the abort of a request the SDK cloned.
 */
type Reply = 'unavailable' | 'refused' | 'answer' | 'hang';

export function mistralServer() {
  const state = { replies: [] as Reply[], requests: 0 };
  const moderation = {
    id: 'm',
    model: 'mistral-moderation-2603',
    results: [{ categories: { selfharm: false }, categoryScores: { selfharm: 0.01 } }],
  };
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      state.requests++;
      const reply = state.replies.shift() ?? 'answer';
      if (reply === 'hang') return new Promise<Response>(() => {});
      if (reply === 'unavailable') return Response.json({ message: 'Service unavailable.' }, { status: 503 });
      if (reply === 'refused') return Response.json({ message: 'Bad request' }, { status: 400 });
      return Response.json(moderation);
    },
  });
  return { server, state };
}

/** How a call ended, and how long it took. */
export async function outcome(call: Promise<unknown>): Promise<{ ended: string; ms: number }> {
  const start = Date.now();
  const ended = await call.then(
    () => 'answered',
    (err: unknown) => (err instanceof Error ? err.constructor.name : 'failed'),
  );
  return { ended, ms: Date.now() - start };
}
