import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import { env } from '../config/env.js';

type FetchLike = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function mistralProvider(fetch?: FetchLike): MistralProvider {
  return createMistral({
    baseURL: `${env.MISTRAL_SERVER_URL}/v1`,
    ...(env.MISTRAL_API_KEY !== undefined && { apiKey: env.MISTRAL_API_KEY }),
    ...(fetch && { fetch: fetch as typeof globalThis.fetch }),
  });
}
