/** The tutor module, wired from its dependencies. */

import type { Auth } from '../../platform/auth/auth';
import type { Db } from '../../platform/db/client';
import { studentDirectory } from '../household';
import { createTutorRepository } from './repository';
import { tutorRoutes } from './routes';
import { createTutorService } from './service';

export function tutorModule({ db, auth }: { db: Db; auth: Auth }) {
  const service = createTutorService({ repository: createTutorRepository(db), students: studentDirectory(db) });
  return { routes: tutorRoutes({ auth, service }) };
}
