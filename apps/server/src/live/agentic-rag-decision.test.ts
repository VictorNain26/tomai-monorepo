/**
 * Live Agentic RAG Decision — le chat est agentique : c'est Mistral qui décide
 * d'appeler (ou non) l'outil RAG `search_educational_content` selon la
 * question, rien dans le code ne force cet appel. Ni `tool-executor.test.ts`
 * (mocke `rag.service`, teste la mécanique d'exécution) ni
 * `chat-rag.test.ts` (appelle `ragService.hybridSearch` directement, teste le
 * grounding) ne couvrent cette DÉCISION. Ce fichier la teste, contre le vrai
 * Mistral, avec la vraie définition d'outil de production (description +
 * inputSchema importées de `chat-tools.ts`, jamais recopiées à la main).
 *
 * Ciblé sur la décision, pas un harnais chat complet : pas de session/élève
 * seedés en DB, `execute` est un stub qui enregistre l'appel (on n'observe
 * pas le retour de l'outil, seulement si le modèle a décidé de l'appeler).
 *
 * LOCAL-ONLY (`bun run test:live`), fail-closed, PAS dans le gate CI.
 */
import { describe, it, expect } from 'bun:test';
import { generateText, tool, stepCountIs, type ToolSet } from 'ai';
import { mistralProvider } from '../lib/ai/provider';
import { env } from '../config/env';
import { buildChatTools } from '../services/chat/chat-tools';
import { buildSystemPrompt } from '../config/prompts/index';
import { getLevelText } from '../config/education/index';
import { HAS_MISTRAL } from './_creds';

const RAG_TOOL_NAME = 'search_educational_content';

/**
 * Toolset réel (mêmes 5 outils, mêmes description/inputSchema que la prod)
 * mais avec un `execute` stub sur chacun : on veut isoler la DÉCISION du
 * modèle, pas exécuter du vrai RAG/DB pour un test qui ne regarde jamais le
 * retour des outils.
 */
function buildDecisionToolset(calls: string[]): ToolSet {
  const prodTools = buildChatTools({
    userId: 'live-test-user',
    sessionId: 'live-test-session',
    schoolLevel: 'sixieme',
    userRole: 'student',
    emitDeckCreated: () => {},
  });

  return Object.fromEntries(
    Object.entries(prodTools).map(([name, prodTool]) => [
      name,
      tool({
        description: prodTool.description,
        inputSchema: prodTool.inputSchema,
        execute: async () => {
          calls.push(name);
          return { stub: true };
        },
      }),
    ]),
  ) as ToolSet;
}

// Vrai system prompt de prod (politique RAG incluse : "appelle
// search_educational_content AVANT de répondre" pour toute question
// scolaire — cf. `config/prompts/core/rag-policy.ts`). Un system prompt
// minimal maison ne reproduit pas cette policy et fausserait la décision
// observée (vérifié empiriquement : sans elle, Mistral répond directement
// de mémoire sur une question de périmètre de cercle).
const SYSTEM_PROMPT = buildSystemPrompt({
  level: 'sixieme',
  levelText: getLevelText('sixieme'),
});

async function askAndDidCallRagTool(question: string): Promise<boolean> {
  const calls: string[] = [];

  await generateText({
    model: mistralProvider()(env.MISTRAL_MODEL),
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
    tools: buildDecisionToolset(calls),
    // Un seul step : on observe la décision de premier tour, pas la synthèse
    // finale après résultat d'outil (hors scope de ce test).
    stopWhen: stepCountIs(1),
    // temperature 0 (prod : 0.7) : on mesure la policy de décision, pas sa
    // variance. parallelToolCalls (désactivé en prod) est sans effet ici :
    // seule compte la présence de l'appel RAG, pas les appels concurrents.
    temperature: 0,
    abortSignal: AbortSignal.timeout(45_000),
  });

  return calls.includes(RAG_TOOL_NAME);
}

/** Répète k fois et compte les succès (le LLM est non-déterministe). */
async function countTrue(k: number, run: () => Promise<boolean>): Promise<number> {
  let hits = 0;
  for (let i = 0; i < k; i++) {
    // Essais séquentiels voulus (pas de rafale sur l'API Mistral).
    if (await run()) hits++;
  }
  return hits;
}

describe('Agentic RAG decision (live, real Mistral)', () => {
  it('Mistral key present (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it(
    'calls search_educational_content on a clear curriculum question (pass^k, k=3, threshold ≥2)',
    async () => {
      // k=3 / seuil 2 : un LLM peut, une fois sur trois, répondre directement
      // sans passer par l'outil (ex: réponse générique). On exige que la
      // décision "appeler le RAG" soit majoritaire, pas systématique à 100%.
      const hits = await countTrue(3, () =>
        askAndDidCallRagTool("Comment calculer le périmètre d'un cercle ?"),
      );
      expect(hits).toBeGreaterThanOrEqual(2);
    },
    3 * 45_000,
  );

  it(
    'does NOT call search_educational_content on an off-curriculum turn (no over-retrieval)',
    async () => {
      // Seuil à 0 sur 3 (pas de tolérance) : la description de l'outil de
      // prod interdit explicitement son usage sur une salutation ("Ne
      // l'utilise pas pour salutations, Pronote, ou si tu as déjà le
      // contexte d'un appel précédent") — c'est le cas de sur-récupération
      // que ce test garde.
      const hits = await countTrue(3, () => askAndDidCallRagTool('Bonjour, comment tu vas ?'));
      expect(hits).toBe(0);
    },
    3 * 45_000,
  );
});
