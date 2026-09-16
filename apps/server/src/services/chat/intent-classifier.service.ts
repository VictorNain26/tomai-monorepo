/**
 * Intent classifier — pre-generation pedagogical intent detection.
 *
 * Runs a lightweight Mistral pass (ministral-8b, 80 output tokens max) BEFORE
 * the main chat generation to detect high-risk pedagogical
 * patterns and inject a reinforcing instruction into the system prompt.
 *
 * Primary use case: the "solve this for me" request. Without a classifier,
 * the agent relies entirely on its base safety block. With a classifier we
 * can add a turn-specific <critical_instruction> block that forces socratic
 * decomposition — measurably reducing answer-leaks in internal tests.
 *
 * Failure mode: if the classifier errors out, we log at high severity and
 * return `intent: 'unknown'` so the agent runs with its default prompt. This
 * is not a silent fallback — callers can observe `intent.error` on the
 * returned object and the log line is monitored.
 */

import { generateStructured } from '../../lib/ai/mistral-client.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import { env } from '../../config/env.js';
import { STUDENT_SUBJECTS, type StudentSubject } from '../../config/prompts/adaptation/subjects.js';

const INTENT_CLASSIFIER_PROMPT_VERSION = '2026-06-29-subject';

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
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
  subject: StudentSubject;
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

const RESPONSE_SCHEMA = {
  name: 'intent_classification',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ALLOWED_INTENTS,
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
      },
      subject: {
        type: 'string',
        enum: STUDENT_SUBJECTS,
      },
    },
    required: ['intent', 'confidence', 'subject'],
    additionalProperties: false,
  },
} as const;

// Cache stable pour prompt cache Mistral (-90 % sur cached tokens).
// À bumper si le prompt change pour forcer un nouveau cache.
const INTENT_CACHE_KEY = `intent-classifier-${INTENT_CLASSIFIER_PROMPT_VERSION}`;

function buildPrompt(userMessage: string, levelLabel: string): string {
  const truncated = userMessage.length > 800 ? `${userMessage.slice(0, 800)}…` : userMessage;
  return `Tu classes l'intention d'un message d'élève français (niveau ${levelLabel}) envoyé à un tuteur scolaire.

Choisis UNE étiquette pour l'intention :
- "solve-this-for-me" : l'élève demande explicitement la solution/résultat ("donne-moi la réponse", "résous", "fais l'exo")
- "check-my-answer" : l'élève propose une réponse/raisonnement et attend validation
- "explain-concept" : l'élève veut comprendre une notion, pas une réponse à un exo précis
- "clarify-question" : l'élève ne comprend pas l'énoncé ou demande reformulation
- "chit-chat" : salutation, remerciement, question hors sujet scolaire
- "unknown" : ambigu ou ne rentre dans aucune autre catégorie

Choisis UNE matière parmi : mathematiques, francais, langues, sciences, histoire-geo, general.
Utilise "general" si le message est hors-matière ou si la matière est indéterminable.

Attribue une confiance (low/medium/high). Réponds en JSON strict.

MESSAGE :
${truncated}`;
}

class IntentClassifierService {
  async classify(userMessage: string, schoolLevel: EducationLevelType): Promise<ClassifiedIntent> {
    const trimmed = userMessage.trim();

    // Short or empty messages: classification wastes a call. Empty is
    // structurally unknown, short greetings are obviously chit-chat.
    if (trimmed.length < 3) {
      return { intent: 'unknown', confidence: 'low', subject: 'general' };
    }
    if (trimmed.length < 15 && /^(bonjour|salut|coucou|hello|merci|ok|oui|non)/i.test(trimmed)) {
      return { intent: 'chit-chat', confidence: 'high', subject: 'general' };
    }

    const startTime = Date.now();
    try {
      const parsed = await generateStructured<{ intent?: string; confidence?: string; subject?: string }>({
        model: env.MISTRAL_MODEL_CLASSIFY,
        messages: [{ role: 'user', content: buildPrompt(trimmed, schoolLevel) }],
        temperature: 0,
        maxTokens: 96,
        schema: RESPONSE_SCHEMA,
        promptCacheKey: INTENT_CACHE_KEY,
        timeoutMs: 8_000,
      });

      const intent = ALLOWED_INTENTS.includes(parsed.intent as StudentIntent)
        ? (parsed.intent as StudentIntent)
        : 'unknown';
      const confidence = parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'low';
      const subject = (STUDENT_SUBJECTS as readonly string[]).includes(parsed.subject ?? '')
        ? (parsed.subject as StudentSubject)
        : 'general';

      logger.debug('Intent classified', {
        operation: 'intent-classifier:classified',
        intent,
        confidence,
        subject,
        durationMs: Date.now() - startTime,
      });

      return { intent, confidence, subject };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Intent classifier failed', {
        operation: 'intent-classifier:error',
        _error: errorMessage,
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
      return { intent: 'unknown', confidence: 'low', subject: 'general', error: errorMessage };
    }
  }

  /**
   * Build a turn-specific reinforcement block to prepend to the system
   * prompt when the classifier detected a risky intent. Returns `null` when
   * no reinforcement is needed.
   */
  buildReinforcement(intent: Pick<ClassifiedIntent, 'intent' | 'confidence'>): string | null {
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
