import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import { env } from '../../config/env.js';

type FetchLike = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function mistralProvider(fetch?: FetchLike): MistralProvider {
  return createMistral({
    apiKey: env.MISTRAL_API_KEY,
    baseURL: `${env.MISTRAL_SERVER_URL}/v1`,
    fetch: fetch as typeof globalThis.fetch | undefined,
  });
}
