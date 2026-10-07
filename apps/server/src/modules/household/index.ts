/** The household module, wired from its dependencies: its routes, and the guard app.ts puts before better-auth. */

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
