/**
 * Live Chat+RAG — le VRAI flux produit : question d'élève → boucle agentique
 * Mistral (`generateStreamChunks`) qui DÉCIDE d'appeler (ou non) le tool
 * `search_educational_content` → retrieval Qdrant + ai-service → réponse ancrée.
 *
 * La décision N'EST PAS hardcodée : aucune règle en code ne force le tool, c'est
 * Mistral qui émet (ou non) le `tool_call`. Sa fiabilité vient de la policy du
 * system prompt (`config/prompts/core/rag-policy.ts` : « pour TOUTE question
 * scolaire, appelle search_educational_content »), pas d'un `if`.
 *
 * On valide la décision dans les DEUX sens, en MULTI-ESSAIS à seuil (pass^k)
 * pour être stable malgré la nature stochastique du modèle :
 *   1. question de cours   → le RAG est déclenché (≥ seuil) + réponse ancrée.
 *   2. tour non-pédagogique → le RAG n'est JAMAIS déclenché (0 / N).
 *
 * LOCAL-ONLY (`bun run test:live`), fail-closed.
 */
import { describe, it, expect } from 'bun:test';
import { mistralChatService } from '../services/chat/mistral-chat.service';
import type { EducationLevelType } from '../types/index';
import { HAS_MISTRAL, ragReachable } from './_creds';

const ready = HAS_MISTRAL && (await ragReachable());

/** Essais par cas : assez pour absorber l'aléa du modèle, assez peu pour rester rapide. */
const TRIALS = 3;
const GROUNDING_RE = /cercle|périmètre|rayon|circonférence|π|pi/;

interface AgentTurn {
  content: string;
  usedRAG: boolean;
  toolsUsed: string[];
}

/** Drive un tour de chat via le vrai flux backend et agrège le résultat. */
async function runChatTurn(params: {
  question: string;
  niveau: EducationLevelType;
  matiere?: string;
}): Promise<AgentTurn> {
  let content = '';
  let usedRAG = false;
  let toolsUsed: string[] = [];

  for await (const chunk of mistralChatService.generateStreamChunks({
    userId: 'e2e-rag',
    sessionId: 'e2e-rag-session',
    userRole: 'student',
    schoolLevel: params.niveau,
    ...(params.matiere ? { subject: params.matiere } : {}),
    content: params.question,
    conversationHistory: [],
  })) {
    if (chunk.type === 'content') {
      content = chunk.content ?? content;
    } else if (chunk.type === 'done') {
      usedRAG = chunk.metadata?.usedRAG ?? false;
      toolsUsed = chunk.metadata?.toolsUsed ?? [];
    } else if (chunk.type === 'error') {
      throw new Error(`stream error (${chunk.error?.code}): ${chunk.error?.message}`);
    }
  }

  return { content, usedRAG, toolsUsed };
}

async function runTrials(
  params: { question: string; niveau: EducationLevelType; matiere?: string },
  n: number,
): Promise<AgentTurn[]> {
  const turns: AgentTurn[] = [];
  for (let i = 0; i < n; i++) {
    turns.push(await runChatTurn(params));
  }
  return turns;
}

describe('Chat + RAG live (real agentic backend flow)', () => {
  it('Mistral key + RAG services reachable (fail-closed, no silent skip)', () => {
    expect(ready).toBe(true);
  });

  it('reliably triggers the RAG on curriculum questions and answers grounded', async () => {
    const turns = await runTrials(
      { question: "Comment calculer le périmètre d'un cercle ?", niveau: 'sixieme', matiere: 'mathematiques' },
      TRIALS,
    );

    const triggered = turns.filter((t) => t.usedRAG).length;
    const grounded = turns.filter((t) => GROUNDING_RE.test(t.content.toLowerCase())).length;
    console.log(`[chat.agent:course] trigger=${triggered}/${TRIALS} grounded=${grounded}/${TRIALS}`);

    // Trajectoire : la majorité des essais déclenchent le RAG (seuil pass^k —
    // tolère un aléa isolé sans masquer une vraie régression du déclenchement).
    expect(triggered).toBeGreaterThanOrEqual(2);
    // Ancrage : chaque essai qui a déclenché le RAG répond bien sur le sujet.
    for (const t of turns.filter((t) => t.usedRAG)) {
      expect(t.content.toLowerCase()).toMatch(GROUNDING_RE);
    }
  }, 180_000);

  it('never triggers the RAG on a non-curriculum turn (no over-retrieval)', async () => {
    const turns = await runTrials({ question: 'Salut Tom, ça va aujourd’hui ?', niveau: 'sixieme' }, TRIALS);

    const triggered = turns.filter((t) => t.usedRAG).length;
    console.log(`[chat.agent:chitchat] trigger=${triggered}/${TRIALS}`);

    // Une salutation ne doit JAMAIS aller fouiller le programme.
    expect(triggered).toBe(0);
    for (const t of turns) {
      expect(t.content.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
