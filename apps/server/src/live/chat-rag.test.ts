/**
 * Live Chat+RAG — le VRAI flux produit : question d'élève → boucle agentique
 * Mistral (`generateStreamChunks`) qui DÉCIDE d'appeler le tool
 * `search_educational_content` → retrieval Qdrant + ai-service → réponse ancrée.
 * On valide la chaîne via le backend, pas un enchaînement manuel : un RAG non
 * déclenché (réponse « de mémoire ») fait échouer le test. LOCAL-ONLY
 * (`bun run test:live`), fail-closed.
 */
import { describe, it, expect } from 'bun:test';
import { mistralChatService } from '../services/chat/mistral-chat.service';
import type { EducationLevelType } from '../types/index';
import { HAS_MISTRAL, ragReachable } from './_creds';

const ready = HAS_MISTRAL && (await ragReachable());

interface AgentTurn {
  content: string;
  usedRAG: boolean;
  toolsUsed: string[];
}

/** Drive un tour de chat via le vrai flux backend et agrège le résultat. */
async function runChatTurn(params: {
  question: string;
  niveau: EducationLevelType;
  matiere: string;
}): Promise<AgentTurn> {
  let content = '';
  let usedRAG = false;
  let toolsUsed: string[] = [];

  for await (const chunk of mistralChatService.generateStreamChunks({
    userId: 'e2e-rag',
    sessionId: 'e2e-rag-session',
    userRole: 'student',
    schoolLevel: params.niveau,
    subject: params.matiere,
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

describe('Chat + RAG live (real agentic backend flow)', () => {
  it('Mistral key + RAG services reachable (fail-closed, no silent skip)', () => {
    expect(ready).toBe(true);
  });

  it('Mistral triggers the RAG tool and answers grounded in the curriculum', async () => {
    const turn = await runChatTurn({
      question: "Comment calculer le périmètre d'un cercle ?",
      niveau: 'sixieme',
      matiere: 'mathematiques',
    });

    // Trajectoire : Mistral a DÉCIDÉ d'appeler le RAG dans le vrai flux produit.
    expect(turn.usedRAG).toBe(true);
    expect(turn.toolsUsed).toContain('search_educational_content');

    // Réponse : non vide et ancrée sur le sujet (assertion non-LLM, déterministe).
    expect(turn.content.length).toBeGreaterThan(0);
    expect(turn.content.toLowerCase()).toMatch(/cercle|périmètre|rayon|circonférence|π|pi/);

    console.log(
      `[chat.agent] usedRAG=${turn.usedRAG} tools=[${turn.toolsUsed.join(',')}] ` +
        `answerLen=${turn.content.length}`,
    );
  }, 90_000);
});
