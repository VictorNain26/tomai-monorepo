/** The household module, wired from its dependencies: its routes, and the guard app.ts puts before better-auth. */

import type { Auth } from '../../platform/auth/auth';
import type { Db } from '../../platform/db/client';
import { createHouseholdRepository } from './repository';
import { householdRoutes, studentAuthGuard } from './routes';
import { createHouseholdService } from './service';

export function householdModule({ db, auth }: { db: Db; auth: Auth }) {
  const service = createHouseholdService({
    repository: createHouseholdRepository(db),
    hashPassword: async (password) => (await auth.$context).password.hash(password),
  });
  return { routes: householdRoutes({ auth, service }), authGuard: studentAuthGuard({ auth, service }) };
}
