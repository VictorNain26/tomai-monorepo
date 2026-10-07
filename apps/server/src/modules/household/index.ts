/**
 * The household module, wired from its dependencies: its routes, the guard app.ts puts before
 * better-auth, and a user's deletion with what it takes, which main.ts hands to better-auth.
 */

import type { Auth } from '../../platform/auth/auth';
import { createPairingCode } from '../../platform/auth/pairing';
import type { Db } from '../../platform/db/client';
import { createHouseholdRepository } from './repository';
import { householdRoutes, meRoutes, studentAuthGuard } from './routes';
import { createHouseholdService, learnerMemory, type MemoryAnswer } from './service';

export function householdModule({ db, auth }: { db: Db; auth: Auth }) {
  const service = createHouseholdService({
    repository: createHouseholdRepository(db),
    createPairingCode: (userId) => createPairingCode(auth, userId),
  });
  return { routes: householdRoutes({ auth, service }), me: meRoutes({ auth, service }), authGuard: studentAuthGuard({ auth, service }) };
}

/**
 * The signed-in student's profile, for the tutor: their learner memory's state and last reset
 * with it; null for anyone who is not a student. The tutor records the student's answer here.
 */
export function studentDirectory(db: Db) {
  const repository = createHouseholdRepository(db);
  return {
    async find(userId: string) {
      const profile = await repository.findProfile(userId);
      if (!profile) return null;
      const { birthMonth, memoryProposedAt, memoryAnswer, memoryResetAt, ...student } = profile;
      return { ...student, memory: learnerMemory({ birthMonth, memoryProposedAt, memoryAnswer, memoryResetAt }, new Date()) };
    },
    answerMemory: (studentId: string, answer: MemoryAnswer) => repository.answerMemory(studentId, answer),
    resetMemory: (studentId: string) => repository.resetMemory(studentId),
  };
}

export type StudentDirectory = ReturnType<typeof studentDirectory>;

/** A user's deletion, with a sole guardian's household and students, in one transaction. */
export function accountDeletion(db: Db) {
  const repository = createHouseholdRepository(db);
  return (userId: string) => repository.deleteAccount(userId);
}
