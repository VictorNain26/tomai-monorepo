// chatStream jette si env.MISTRAL_API_KEY est absent.
// On patch directement l'objet singleton exporté par env.ts (le const objet est mutable).
import { env } from '../../config/env.js';

if (!env.MISTRAL_API_KEY) {
  (env as Record<string, unknown>)['MISTRAL_API_KEY'] = 'test-key';
}
