/** The household module, wired from its dependencies: what app.ts mounts. */

import type { Auth } from '../../platform/auth/auth';
import type { Db } from '../../platform/db/client';
import { createHouseholdRepository } from './repository';
import { householdRoutes } from './routes';
import { createHouseholdService } from './service';

export function householdModule({ db, auth }: { db: Db; auth: Auth }) {
  const service = createHouseholdService({
    repository: createHouseholdRepository(db),
    hashPassword: async (password) => (await auth.$context).password.hash(password),
  });
  return householdRoutes({ auth, service });
}
