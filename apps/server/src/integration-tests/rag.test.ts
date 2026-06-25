/**
 * Tests d'intégration RAG - Appels réels Qdrant + ai-service
 * Vérifie que les réponses sont correctes et pertinentes
 *
 * Requires: QDRANT_URL, QDRANT_API_KEY, AI_SERVICE_URL (BGE-M3 + rerank)
 * Run: bun run test:integration
 */

import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { ragService } from '../services/rag.service';
import { qdrantService } from '../services/qdrant.service';
import { aiServiceClient } from '../services/ai-service.client';

const ragVarsPresent = Boolean(
  process.env.QDRANT_URL &&
  process.env.QDRANT_API_KEY &&
  process.env.AI_SERVICE_URL
);

// When vars are present, verify services are actually reachable before running.
// This prevents spurious timeouts when the stack is configured but not running.
async function checkServicesReachable(): Promise<boolean> {
  if (!ragVarsPresent) return false;
  const [qdrantOk, aiOk] = await Promise.all([
    qdrantService.isAvailable().catch(() => false),
    aiServiceClient.isAvailable().catch(() => false),
  ]);
  return qdrantOk && aiOk;
}

const ragCredsPresent = await checkServicesReachable();

if (!ragVarsPresent) {
  console.warn('[rag.test] QDRANT_URL / QDRANT_API_KEY / AI_SERVICE_URL absent — RAG integration suite skipped');
} else if (!ragCredsPresent) {
  console.warn('[rag.test] Qdrant or ai-service unreachable — RAG integration suite skipped');
}

// Golden set réel du curriculum (source de vérité, questions stratifiées avec
// gold_chunk_id). On n'évalue que les questions dont (matiere, niveau) sont
// réellement présents dans la collection ; le hors-couverture (lycée, matières
// non indexées) est compté à part, jamais en échec.
interface GoldenQuestion {
  query: string;
  matiere: string;
  niveau: string;
  expected_keywords: string[];
  gold_chunk_id: string;
}
const GOLDEN_PATH = path.resolve(
  import.meta.dir,
  '../../../curriculum/data/golden/questions.json',
);
const GOLDEN: GoldenQuestion[] =
  ragCredsPresent && fs.existsSync(GOLDEN_PATH)
    ? (JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8')) as GoldenQuestion[])
    : [];

describe.skipIf(!ragCredsPresent)('RAG Integration Tests - Real Qdrant Calls', () => {

  describe('Service Availability', () => {
    it('should have Qdrant available', async () => {
      const available = await qdrantService.isAvailable();
      expect(available).toBe(true);
    });

    it('should have ai-service available (BGE-M3 + rerank)', async () => {
      const available = await aiServiceClient.isAvailable();
      expect(available).toBe(true);
    });

    it('should have RAG service available', async () => {
      const available = await ragService.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Qdrant Collection Stats', () => {
    it('should return collection statistics', async () => {
      const stats = await qdrantService.getStats();

      expect(stats.total_points).toBeGreaterThan(0);
      expect(Object.keys(stats.by_niveau).length).toBeGreaterThan(0);
      expect(Object.keys(stats.by_matiere).length).toBeGreaterThan(0);
    });

    it('should have cinquieme documents', async () => {
      const stats = await qdrantService.getStats();

      expect(stats.by_niveau['cinquieme']).toBeGreaterThan(0);
    });
  });

  describe('RAG recall on golden set (real curriculum questions)', () => {
    it('covered questions return results; keyword recall@5 >= 0.5', async () => {
      const stats = await qdrantService.getStats();
      const niveaux = new Set(Object.keys(stats.by_niveau));
      const matieres = new Set(Object.keys(stats.by_matiere));
      const covered = GOLDEN.filter(
        (q) => niveaux.has(q.niveau) && matieres.has(q.matiere),
      );
      expect(covered.length).toBeGreaterThan(0);

      let nonEmpty = 0;
      let kwHit5 = 0;
      let idHit5 = 0;
      let idHit20 = 0;
      for (const q of covered) {
        const emb = await aiServiceClient.embed(q.query);
        const results = await qdrantService.searchHybrid(
          emb.dense,
          emb.sparse,
          { niveau: q.niveau, matiere: q.matiere },
          20,
          { hnswEf: 128 },
        );
        if (results.length > 0) nonEmpty++;
        const ids = results.map((r) => r.id);
        if (ids.slice(0, 5).includes(q.gold_chunk_id)) idHit5++;
        if (ids.includes(q.gold_chunk_id)) idHit20++;
        const top5Text = results
          .slice(0, 5)
          .map((r) => r.text.toLowerCase())
          .join(' ');
        if (q.expected_keywords.some((k) => top5Text.includes(k.toLowerCase())))
          kwHit5++;
      }
      const n = covered.length;
      const kwRecall5 = kwHit5 / n;
      console.log(
        `[rag.golden] covered=${n}/${GOLDEN.length} ` +
          `nonEmpty=${(nonEmpty / n).toFixed(3)} ` +
          `keywordRecall@5=${kwRecall5.toFixed(3)} ` +
          `chunkIdRecall@5=${(idHit5 / n).toFixed(3)} ` +
          `chunkIdRecall@20=${(idHit20 / n).toFixed(3)}`,
      );
      // Gate robuste : quasi toutes les questions couvertes renvoient des
      // résultats, et au moins la moitié font remonter un mot-clé attendu dans
      // le top-5. Le chunk_id exact est loggé mais non gaté (il dépend de la
      // synchro collection ↔ golden set, plus fragile).
      expect(nonEmpty / n).toBeGreaterThanOrEqual(0.95);
      expect(kwRecall5).toBeGreaterThanOrEqual(0.5);
    }, 180_000);
  });

  describe('RAG Search Performance', () => {
    it('should complete search in reasonable time (<3s)', async () => {
      const start = Date.now();

      await ragService.hybridSearch({
        query: 'Comment calculer une fraction ?',
        niveau: 'cinquieme',
        matiere: 'mathematiques',
        limit: 5,
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('RAG Search Edge Cases', () => {
    it('should handle query with no good matches gracefully', async () => {
      const result = await ragService.hybridSearch({
        query: 'recette de cuisine poulet rôti',
        niveau: 'cinquieme',
        matiere: 'mathematiques',
        limit: 5,
      });

      // Peut retourner 0 résultats ou résultats avec score bas
      // L'important c'est de ne pas crash
      expect(result.context).toBeDefined();
      expect(result.semanticChunks).toBeDefined();
    });

    it('should filter by matiere correctly', async () => {
      const result = await ragService.hybridSearch({
        query: 'grammaire conjugaison',
        niveau: 'cinquieme',
        matiere: 'francais',
        limit: 5,
      });

      // Tous les résultats doivent être en français — vérifier via le contexte
      if (result.semanticChunks.length > 0) {
        expect(result.context).not.toContain('mathematiques:');
      }
    });
  });

  describe('Payload contract round-trip', () => {
    it('returns the 7 canonical curriculum payload fields, correctly typed', async () => {
      const queryEmbed = await aiServiceClient.embed('Comment calculer une aire ?');
      const results = await qdrantService.searchHybrid(
        queryEmbed.dense,
        queryEmbed.sparse,
        { niveau: 'cinquieme', matiere: 'mathematiques' },
        20,
        { hnswEf: 128 },
      );
      expect(results.length).toBeGreaterThan(0);

      const top = results[0]!;
      expect(typeof top.text).toBe('string');
      expect(top.text.length).toBeGreaterThan(0);
      expect(typeof top.section).toBe('string');
      expect(top.matiere).toBe('mathematiques');
      expect(top.niveau).toBe('cinquieme');
      expect(['cycle3', 'cycle4', 'lycee']).toContain(top.cycle);
      expect(typeof top.source_file).toBe('string');
      expect(top.source_file.length).toBeGreaterThan(0);
      expect(typeof top.chunk_index).toBe('number');
      expect(top.chunk_index).toBeGreaterThanOrEqual(0);
    });
  });
});
