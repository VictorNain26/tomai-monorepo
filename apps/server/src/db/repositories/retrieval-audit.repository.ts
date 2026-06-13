/**
 * Retrieval audit repository — append-only persistence for RGPD article 30.
 *
 * Single method: `log()`. No find / update / delete on the application path
 * (deletions are driven by RGPD jobs outside the runtime call graph).
 *
 * The hash is computed here, not by the caller, so every callsite gets the
 * same normalisation (`trim().toLowerCase()`) and there's only one place to
 * change the hashing algorithm if we ever migrate it.
 */

import { createHash } from 'node:crypto';
import { db } from '../connection.js';
import { retrievalAudit, type NewRetrievalAudit } from '../schema/audit.schema.js';
import { logger } from '../../lib/observability.js';

interface LogRetrievalInput {
  userId: string | null;
  sessionId?: string | null;
  /** Raw query string — hashed before insert, never persisted as-is. */
  query: string;
  niveau: string;
  matiere?: string | null;
  resultsCount: number;
  avgScore?: number | null;
  durationMs: number;
  strategy: string;
}

function hashQuery(query: string): string {
  return createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
}

class RetrievalAuditRepository {
  /**
   * Fire-and-forget insert. The caller is expected to await this with
   * `void` so a DB blip never blocks the retrieval response path — we log
   * the failure at WARN level and keep going. Audit completeness is best
   * effort; the right-to-be-informed surface is the explicit DSAR query
   * on this table, which tolerates gaps.
   */
  async log(input: LogRetrievalInput): Promise<void> {
    try {
      const row: NewRetrievalAudit = {
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        queryHash: hashQuery(input.query),
        niveau: input.niveau,
        matiere: input.matiere ?? null,
        resultsCount: input.resultsCount,
        avgScore: input.avgScore ?? null,
        durationMs: input.durationMs,
        strategy: input.strategy,
      };
      await db.insert(retrievalAudit).values(row);
    } catch (error) {
      logger.warn('retrieval audit log failed (non-blocking)', {
        operation: 'retrieval-audit:log',
        _error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const retrievalAuditRepository = new RetrievalAuditRepository();
