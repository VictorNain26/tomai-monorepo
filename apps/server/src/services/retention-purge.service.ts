import { lt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { sessionEpisodes, studentSubjectProfiles } from '../db/schema/learning.schema.js';
import { logger } from '../lib/observability.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function purgeExpiredData(): Promise<{
  episodesDeleted: number;
  profilesDeleted: number;
}> {
  const now = new Date();

  const episodesResult = await db
    .delete(sessionEpisodes)
    .where(lt(sessionEpisodes.ttlUntil, now));

  const profilesResult = await db
    .delete(studentSubjectProfiles)
    .where(lt(studentSubjectProfiles.ttlUntil, now));

  const episodesDeleted =
    (episodesResult as unknown as { rowCount?: number })?.rowCount ?? 0;
  const profilesDeleted =
    (profilesResult as unknown as { rowCount?: number })?.rowCount ?? 0;

  logger.info('Retention purge completed', {
    operation: 'retention-purge:run',
    episodesDeleted,
    profilesDeleted,
  });

  return { episodesDeleted, profilesDeleted };
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
