/**
 * What a signed-in student does with their sessions. Only a student reaches them: a guardian
 * follows the work through the parent's summary, never the conversations.
 */

import { Problem } from '../../platform/http/problem';
import type { StudentDirectory } from '../household';
import type { TutorRepository } from './repository';

interface Deps {
  repository: TutorRepository;
  students: StudentDirectory;
}

export function createTutorService({ repository, students }: Deps) {
  const student = async (userId: string) => {
    const profile = await students.find(userId);
    if (!profile) throw new Problem('FORBIDDEN');
    return profile;
  };

  return {
    async startSession(userId: string) {
      await student(userId);
      return repository.createSession(userId);
    },

    async listSessions(userId: string) {
      await student(userId);
      return repository.listSessions(userId);
    },

    async listMessages(userId: string, sessionId: string) {
      await student(userId);
      if (!(await repository.findSession(userId, sessionId))) throw new Problem('NOT_FOUND');
      return repository.listMessages(userId, sessionId);
    },
  };
}

export type TutorService = ReturnType<typeof createTutorService>;
