/** The tutor module, wired from its dependencies. */

import type { Logger } from 'pino';
import type { Ai } from '../../platform/ai/client';
import type { Moderation } from '../../platform/ai/moderation';
import type { Auth } from '../../platform/auth/auth';
import type { Db } from '../../platform/db/client';
import { studentDirectory } from '../household';
import { createTutorRepository } from './repository';
import { tutorRoutes } from './routes';
import { createTutorService } from './service';

interface Deps {
  db: Db;
  auth: Auth;
  ai: Ai;
  moderation: Moderation;
  logger: Logger;
  background: (task: Promise<unknown>) => void;
}

export function tutorModule({ db, auth, ai, moderation, logger, background }: Deps) {
  const service = createTutorService({ repository: createTutorRepository(db), students: studentDirectory(db), ai, moderation, logger, background });
  return { routes: tutorRoutes({ auth, service, logger }) };
}
