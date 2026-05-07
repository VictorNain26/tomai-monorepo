/**
 * Mistral guardrails — Tom's safety policy for a minor-facing service.
 *
 * Mistral's officially recommended moderation pattern (2026): pass a
 * `guardrails: [{ blockOnError, moderationLlmV2: { … } }]` array on
 * chat.complete / chat.stream and Mistral applies its `mistral-moderation`
 * model to every input + output, returning HTTP 403 with category details
 * when a threshold is crossed.
 *
 * @see https://docs.mistral.ai/capabilities/guardrailing/
 *
 * We expose two builders:
 *  - `studentChatGuardrails()` for the main tutor chat and any path that
 *    handles raw student input (uploaded documents, voice transcripts, …)
 *  - The default thresholds are deliberately strict: Tom's audience is
 *    CP–Terminale (ages 6–18), so we keep sexual/selfharm/violence/PII at
 *    0.1 and jailbreaking at 0.2 per Mistral's own recommendation for
 *    minor-facing apps.
 *
 * Internal/auxiliary services (intent classifier, summarizer, auto-title,
 * episodic memory, card generator) do NOT need guardrails: their inputs
 * are either internal prompts or already-filtered chat messages, and
 * adding a moderation pass on each would double the API cost on every
 * turn for no security benefit.
 */
import type { GuardrailConfig } from '@mistralai/mistralai/models/components/guardrailconfig.js';

export function studentChatGuardrails(): GuardrailConfig[] {
  return [
    {
      // 403 the request if Mistral itself fails to moderate. We prefer a
      // hard block over a silent bypass — losing a turn is acceptable,
      // shipping unmoderated content to a 6-year-old is not.
      blockOnError: true,
      moderationLlmV2: {
        customCategoryThresholds: {
          sexual: 0.1,
          selfharm: 0.1,
          violenceAndThreats: 0.1,
          hateAndDiscrimination: 0.1,
          dangerous: 0.1,
          criminal: 0.1,
          pii: 0.1,
          jailbreaking: 0.2,
        },
        ignoreOtherCategories: false,
        action: 'block',
      },
    },
  ];
}
