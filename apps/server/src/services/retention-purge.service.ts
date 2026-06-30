import { lt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { sessionEpisodes, studentSubjectProfiles } from '../db/schema/learning.schema.js';
import { retrievalAudit } from '../db/schema/audit.schema.js';
import { logger } from '../lib/observability.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
// Approximation : 365 jours ≈ les « 12 mois » de la politique de
// confidentialité (écart max 1 jour les années bissextiles, côté sûr).
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

export async function purgeExpiredData(): Promise<{
  episodesDeleted: number;
  auditRowsDeleted: number;
  profilesDeleted: number;
}> {
  const now = new Date();
  const auditCutoff = new Date(now.getTime() - TWELVE_MONTHS_MS);

  const episodesResult = await db
    .delete(sessionEpisodes)
    .where(lt(sessionEpisodes.ttlUntil, now));

  const auditResult = await db
    .delete(retrievalAudit)
    .where(lt(retrievalAudit.createdAt, auditCutoff));

  const profilesResult = await db
    .delete(studentSubjectProfiles)
    .where(lt(studentSubjectProfiles.ttlUntil, now));

  const episodesDeleted =
    (episodesResult as unknown as { rowCount?: number })?.rowCount ?? 0;
  const auditRowsDeleted =
    (auditResult as unknown as { rowCount?: number })?.rowCount ?? 0;
  const profilesDeleted =
    (profilesResult as unknown as { rowCount?: number })?.rowCount ?? 0;

  logger.info('Retention purge completed', {
    operation: 'retention-purge:run',
    episodesDeleted,
    auditRowsDeleted,
    profilesDeleted,
  });

  return { episodesDeleted, auditRowsDeleted, profilesDeleted };
}

export function startRetentionPurgeScheduler(): () => void {
  purgeExpiredData().catch((error: unknown) => {
    logger.error('Retention purge failed (startup)', {
      operation: 'retention-purge:error',
      _error: error instanceof Error ? error.message : String(error),
      severity: 'high' as const,
    });
  });

  const interval = setInterval(() => {
    purgeExpiredData().catch((error: unknown) => {
      logger.error('Retention purge failed (scheduled)', {
        operation: 'retention-purge:error',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
    });
  }, TWENTY_FOUR_HOURS_MS);

  interval.unref?.();

  return () => clearInterval(interval);
}
