import { Mistral } from '@mistralai/mistralai';
import { env } from '../../config/env.js';

let client: Mistral | null = null;

export function getMistralSdk(): Mistral {
  if (!env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is required');
  client ??= new Mistral({
    apiKey: env.MISTRAL_API_KEY,
    timeoutMs: env.MISTRAL_TIMEOUT,
    serverURL: env.MISTRAL_SERVER_URL,
  });
  return client;
}
