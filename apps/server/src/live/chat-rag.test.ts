/**
 * Live Chat+RAG — le flux PRODUIT complet : question d'élève → retrieval RAG du
 * programme (Qdrant + ai-service) → réponse pédagogique Mistral ancrée sur le
 * contexte récupéré. Valide la CHAÎNE entière contre les vrais services (le
 * tool-calling exact où Mistral décide d'appeler rag_search reste couvert en
 * unitaire par tool-executor.test.ts). LOCAL-ONLY (`bun run test:live`),
 * fail-closed.
 */
import { describe, it, expect } from 'bun:test';
import { ragService } from '../services/rag.service';
import { generateText } from '../lib/ai/mistral-client';
import { HAS_MISTRAL, ragReachable } from './_creds';

const ready = HAS_MISTRAL && (await ragReachable());

describe('Chat + RAG live (full product flow)', () => {
  it('Mistral key + RAG services reachable (fail-closed, no silent skip)', () => {
    expect(ready).toBe(true);
  });

  it('answers a student question grounded in retrieved curriculum context', async () => {
    const question = "Comment calculer le périmètre d'un cercle ?";

    // 1. Le RAG récupère le vrai contexte du programme officiel.
    const rag = await ragService.hybridSearch({
      query: question,
      niveau: 'sixieme',
      matiere: 'mathematiques',
      limit: 5,
    });
    expect(rag.semanticChunks.length).toBeGreaterThan(0);
    expect(rag.context.length).toBeGreaterThan(0);

    // 2. Mistral répond en s'appuyant sur ce contexte.
    const answer = await generateText({
      messages: [
        {
          role: 'system',
          content:
            "Tu es un tuteur pour collégiens. Réponds à la question en t'appuyant " +
            `sur cet extrait de programme officiel :\n\n${rag.context}`,
        },
        { role: 'user', content: question },
      ],
      maxTokens: 200,
      temperature: 0,
    });

    // 3. La réponse est non vide et sur le sujet.
    expect(answer.length).toBeGreaterThan(0);
    expect(answer.toLowerCase()).toMatch(/cercle|périmètre|rayon|circonférence|π|pi/);
  }, 45_000);
});
