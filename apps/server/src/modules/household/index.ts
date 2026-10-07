/**
 * The household module, wired from its dependencies: its routes, the guard app.ts puts before
 * better-auth, and what a user's deletion takes with it, which main.ts hands to better-auth.
 */

import type { Auth } from '../../platform/auth/auth';
import { createPairingCode } from '../../platform/auth/pairing';
import type { Db } from '../../platform/db/client';
import { createHouseholdRepository } from './repository';
import { householdRoutes, studentAuthGuard } from './routes';
import { createHouseholdService } from './service';

export function householdModule({ db, auth }: { db: Db; auth: Auth }) {
  const service = createHouseholdService({
    repository: createHouseholdRepository(db),
    createPairingCode: (userId) => createPairingCode(auth, userId),
  });
  return { routes: householdRoutes({ auth, service }), authGuard: studentAuthGuard({ auth, service }) };
}

/** Before a user's deletion: a sole guardian's household and its students go too. */
export function householdDeletion(db: Db) {
  const repository = createHouseholdRepository(db);
  return (userId: string) => repository.deleteHouseholdOfSoleGuardian(userId);
}
