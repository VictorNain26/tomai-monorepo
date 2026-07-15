/**
 * Live Chat+RAG — le VRAI flux produit : question d'élève → boucle agentique
 * Mistral (`streamChat` + `buildChatTools`, comme `chat-message.routes.ts`) qui
 * DÉCIDE d'appeler (ou non) `search_educational_content` → retrieval réel
 * Qdrant + ai-service → réponse ancrée.
 *
 * La décision N'EST PAS hardcodée : aucune règle en code ne force le tool, c'est
 * Mistral qui émet (ou non) le `tool_call`. Sa fiabilité vient de la policy du
 * system prompt, pas d'un `if`.
 *
 * On valide la décision dans les DEUX sens, en MULTI-ESSAIS à seuil (pass^k)
 * pour être stable malgré la nature stochastique du modèle :
 *   1. question de cours   → le RAG est déclenché (≥ seuil) + réponse ancrée.
 *   2. tour non-pédagogique → le RAG n'est JAMAIS déclenché (0 / N).
 *
 * LOCAL-ONLY (`bun run test:live`), fail-closed.
 */
import { describe, it, expect } from 'bun:test';
import { streamChat } from '../services/chat/ai-chat.service';
import { buildChatTools } from '../services/chat/chat-tools';
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
  const tools = buildChatTools({
    userId: 'e2e-rag',
    sessionId: 'e2e-rag-session',
    schoolLevel: params.niveau,
    userRole: 'student',
    emitDeckCreated: () => {},
  });

  // Params minimaux : les champs prod restants (intentReinforcement, files,
  // pronoteContext…) sont optionnels — on teste le tour nu, pas leurs effets.
  const result = streamChat({
    userId: 'e2e-rag',
    sessionId: 'e2e-rag-session',
    userRole: 'student',
    schoolLevel: params.niveau,
    ...(params.matiere ? { subject: params.matiere } : {}),
    content: params.question,
    conversationHistory: [],
    tools,
  });

  const content = await result.text;
  const steps = await result.steps;
  const toolsUsed = steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));

  return {
    content,
    usedRAG: toolsUsed.includes('search_educational_content'),
    toolsUsed,
  };
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
