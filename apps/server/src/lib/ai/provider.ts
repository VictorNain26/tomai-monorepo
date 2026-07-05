import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import { env } from '../../config/env.js';

type FetchLike = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function mistralProvider(
  promptCacheKey?: string,
  baseFetch: FetchLike = globalThis.fetch,
): MistralProvider {
  const fetch: FetchLike = async (url, init) => {
    if (!promptCacheKey || typeof init?.body !== 'string') return baseFetch(url, init);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    body.prompt_cache_key = promptCacheKey;
    return baseFetch(url, { ...init, body: JSON.stringify(body) });
  };

  return createMistral({ apiKey: env.MISTRAL_API_KEY, fetch: fetch as typeof globalThis.fetch });
}
