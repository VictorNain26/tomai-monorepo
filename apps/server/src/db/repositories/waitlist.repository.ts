/**
 * Waitlist Repository - Data-access for waitlist_entries.
 *
 * One method = one typed Drizzle query.
 */

import { db } from '../connection';
import { waitlistEntries } from '../schema';

export class WaitlistRepository {
  /**
   * Add an email to the waitlist. Idempotent on the email (case-insensitive,
   * stored lowercased). Returns `true` when a new row was created, `false` when
   * the email was already present.
   */
  async add(email: string, source: string | null): Promise<{ created: boolean }> {
    const result = await db
      .insert(waitlistEntries)
      .values({ email: email.toLowerCase().trim(), source })
      .onConflictDoNothing({ target: waitlistEntries.email })
      .returning({ id: waitlistEntries.id });

    return { created: result.length > 0 };
  }
}

export const waitlistRepository = new WaitlistRepository();
