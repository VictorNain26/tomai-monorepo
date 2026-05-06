/**
 * Intent classifier — pre-generation pedagogical intent detection.
 *
 * Lightweight Mistral Small 4 pass (reasoning_effort none, ~80 output tokens)
 * BEFORE the main chat generation. Detects high-risk pedagogical patterns and
 * injects a reinforcing instruction into the system prompt.
 *
 * Primary use case: the "solve this for me" request. Without a classifier,
 * the agent relies entirely on its base safety block. With a classifier we
 * can add a turn-specific <critical_instruction> block that forces socratic
 * decomposition.
 *
 * Failure mode: if the classifier errors out, we log at high severity and
 * return `intent: 'unknown'` so the agent runs with its default prompt. Not
 * a silent fallback — callers can observe `intent.error` and the log line is
 * monitored.
 */

import { appConfig } from '../../config/app.config.js';
import { getMistralClient } from '../../lib/mistral-client.js';
import { logger } from '../../lib/observability.js';
import { withTimeout } from '../../lib/retry.js';
import type { EducationLevelType } from '../../types/index.js';

export const INTENT_CLASSIFIER_PROMPT_VERSION = '2026-05-06';

export type StudentIntent =
  | 'solve-this-for-me'   // student asks the agent to complete an exercise
  | 'check-my-answer'     // student has an answer, wants validation
  | 'explain-concept'     // student wants a concept explained
  | 'clarify-question'    // student asks to reformulate / clarify
  | 'chit-chat'           // greeting, smalltalk, off-topic
  | 'unknown';            // classifier inconclusive or errored

export interface ClassifiedIntent {
  intent: StudentIntent;
  confidence: 'low' | 'medium' | 'high';
  /** Populated when the classifier itself failed — callers can log/alert. */
  error?: string;
}

const ALLOWED_INTENTS: StudentIntent[] = [
  'solve-this-for-me',
  'check-my-answer',
  'explain-concept',
  'clarify-question',
  'chit-chat',
  'unknown',
];

function isStudentIntent(v: unknown): v is StudentIntent {
  return typeof v === 'string' && (ALLOWED_INTENTS as string[]).includes(v);
}

function isConfidence(v: unknown): v is ClassifiedIntent['confidence'] {
  return v === 'low' || v === 'medium' || v === 'high';
}

function buildPrompt(userMessage: string, levelLabel: string): string {
  const truncated = userMessage.length > 800 ? `${userMessage.slice(0, 800)}…` : userMessage;
  return `Tu classes l'intention d'un message d'élève français (niveau ${levelLabel}) envoyé à un tuteur scolaire.

Choisis UNE étiquette :
- "solve-this-for-me" : l'élève demande explicitement la solution/résultat ("donne-moi la réponse", "résous", "fais l'exo")
- "check-my-answer" : l'élève propose une réponse/raisonnement et attend validation
- "explain-concept" : l'élève veut comprendre une notion, pas une réponse à un exo précis
- "clarify-question" : l'élève ne comprend pas l'énoncé ou demande reformulation
- "chit-chat" : salutation, remerciement, question hors sujet scolaire
- "unknown" : ambigu ou ne rentre dans aucune autre catégorie

Attribue une confiance (low/medium/high). Réponds UNIQUEMENT en JSON strict de la forme :
{"intent": "<étiquette>", "confidence": "<low|medium|high>"}

MESSAGE :
${truncated}`;
}

class IntentClassifierService {
  private readonly model: string;

  constructor() {
    this.model = appConfig.ai.mistral?.auxModel ?? 'mistral-small-latest';
  }

  async classify(userMessage: string, schoolLevel: EducationLevelType): Promise<ClassifiedIntent> {
    const trimmed = userMessage.trim();

    // Short or empty messages: classification wastes a call. Empty is
    // structurally unknown, short greetings are obviously chit-chat.
    if (trimmed.length < 3) {
      return { intent: 'unknown', confidence: 'low' };
    }
    if (trimmed.length < 15 && /^(bonjour|salut|coucou|hello|merci|ok|oui|non)/i.test(trimmed)) {
      return { intent: 'chit-chat', confidence: 'high' };
    }

    const startTime = Date.now();
    try {
      const client = getMistralClient();
      const response = await withTimeout(
        client.chat.complete({
          model: this.model,
          messages: [{ role: 'user', content: buildPrompt(trimmed, schoolLevel) }],
          temperature: 0,
          maxTokens: 80,
          // json_schema strict: Mistral guarantees the response matches the
          // schema bit-for-bit (CCA D4 §4 retry-with-feedback prerequisite).
          // Eliminates malformed-JSON retries seen with json_object mode.
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'student_intent_classification',
              description: 'Classified pedagogical intent of a student message.',
              strict: true,
              schemaDefinition: {
                type: 'object',
                additionalProperties: false,
                required: ['intent', 'confidence'],
                properties: {
                  intent: {
                    type: 'string',
                    enum: ALLOWED_INTENTS,
                    description: 'One of the predefined intent labels.',
                  },
                  confidence: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Classifier confidence in the chosen label.',
                  },
                },
              },
            },
          },
        }),
        8_000,
        'mistral:intent-classify',
      );

      const rawContent = response.choices?.[0]?.message?.content;
      const text = typeof rawContent === 'string' ? rawContent.trim() : '';
      if (text.length === 0) {
        return { intent: 'unknown', confidence: 'low', error: 'empty response' };
      }

      const parsed = JSON.parse(text) as Record<string, unknown>;
      const intent = isStudentIntent(parsed['intent']) ? parsed['intent'] : 'unknown';
      const confidence = isConfidence(parsed['confidence']) ? parsed['confidence'] : 'low';

      logger.debug('Intent classified', {
        operation: 'intent-classifier:classified',
        intent,
        confidence,
        durationMs: Date.now() - startTime,
      });

      return { intent, confidence };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Intent classifier failed', {
        operation: 'intent-classifier:error',
        _error: errorMessage,
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
      return { intent: 'unknown', confidence: 'low', error: errorMessage };
    }
  }

  /**
   * Build a turn-specific reinforcement block to prepend to the system
   * prompt when the classifier detected a risky intent. Returns `null` when
   * no reinforcement is needed.
   */
  buildReinforcement(intent: ClassifiedIntent): string | null {
    if (intent.intent === 'solve-this-for-me' && intent.confidence !== 'low') {
      return `<critical_instruction>
L'élève vient de demander que tu fasses l'exercice à sa place. Tu NE donnes PAS
la réponse finale. Tu décomposes en 1-2 questions socratiques qui l'aident à
démarrer par lui-même. Si après 2-3 échanges il bute vraiment, tu peux
révéler une étape intermédiaire — jamais le résultat complet en premier.
</critical_instruction>`;
    }

    if (intent.intent === 'check-my-answer' && intent.confidence !== 'low') {
      return `<critical_instruction>
L'élève a proposé une réponse. Ne dis PAS "oui/non c'est bon/faux" directement.
Demande-lui d'expliquer SA démarche (« Comment tu as trouvé ? »), puis guide
la vérification. Si la réponse est fausse, pointe la première erreur de
raisonnement sans révéler la bonne réponse.
</critical_instruction>`;
    }

    return null;
  }
}

export const intentClassifierService = new IntentClassifierService();
