/** The tutor module, wired from its dependencies. */

import type { Logger } from 'pino';
import type { Ai } from '../../platform/ai/client';
import type { Moderation } from '../../platform/ai/moderation';
import type { Auth } from '../../platform/auth/auth';
import type { Db } from '../../platform/db/client';
import { studentDirectory } from '../household';
import { createTutorRepository } from './repository';
import { memoryRoutes, summaryRoutes, tutorRoutes } from './routes';
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
  return { routes: tutorRoutes({ auth, service, logger }), memory: memoryRoutes({ auth, service }), summary: summaryRoutes({ auth, service }) };
}

/** The records of a session's turns, for the harness, which plays the route as a student does (src/evaluate.ts). */
export function turnRecords(db: Db) {
  const repository = createTutorRepository(db);
  return (sessionId: string) => repository.records(sessionId);
}
