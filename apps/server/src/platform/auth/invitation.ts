/**
 * Closed beta: a guardian's account is created for an invited address only. An invitation is a
 * verification value of better-auth, keyed by the address, spent once its account is created
 * (./auth.ts). Inviting an address again replaces its invitation.
 */

import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { verification } from './schema';

const INVITATION_PREFIX = 'sign-up-invitation:';
const INVITATION_DAYS = 30;

// better-auth stores an address in lowercase (api/routes/sign-up.mjs): the invitation is keyed the same way.
export const invitationIdentifier = (email: string) => `${INVITATION_PREFIX}${email.trim().toLowerCase()}`;

export async function invite(db: Db, email: string) {
  const identifier = invitationIdentifier(email);
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
  await db.transaction(async (tx) => {
    await tx.delete(verification).where(eq(verification.identifier, identifier));
    await tx.insert(verification).values({ id: crypto.randomUUID(), identifier, value: 'invited', expiresAt });
  });
  return { expiresAt };
}
