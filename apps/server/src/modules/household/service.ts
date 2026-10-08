/**
 * What a guardian does with the students of their household. A student has no credential: no
 * email (the non-routable address better-auth itself makes for an account without one, RFC 6761
 * `.invalid`), no password. Their device is paired by a code the guardian asks for, and the
 * guardian never gets a session of their child.
 */

import { createPlaceholderEmail } from '@better-auth/core/utils/email';
import { generateId } from '@better-auth/core/utils/id';
import { isAccompaniedLevel, type SchoolLevel } from '../../domain/levels';
import { memoryConsent, type MemoryAnswer } from '../../domain/memory-consent';

export type { MemoryAnswer };
import { Problem } from '../../platform/http/problem';
import type { HouseholdRepository } from './repository';

export interface StudentInput {
  name: string;
  level: SchoolLevel;
  birthMonth: string;
  memoryProposed?: boolean | undefined;
}

interface Deps {
  repository: HouseholdRepository;
  createPairingCode: (userId: string) => Promise<{ code: string; expiresAt: Date }>;
}

type StudentRow = NonNullable<Awaited<ReturnType<HouseholdRepository['findStudent']>>>;

/** The student's learner memory as the tutor reads it; the child answers once the parent proposed it, or alone from 15. */
export function learnerMemory(
  profile: { birthMonth: string; memoryProposedAt: Date | null; memoryAnswer: MemoryAnswer | null; memoryResetAfter: number | null },
  now: Date,
) {
  const { state, mayAnswer } = memoryConsent(
    { birthMonth: profile.birthMonth, proposedAt: profile.memoryProposedAt, answer: profile.memoryAnswer },
    now,
  );
  return { state, mayAnswer, resetAfter: profile.memoryResetAfter ?? 0 };
}

// The date column holds the first day of the month; the API speaks in YYYY-MM.
const toStudent = ({ birthMonth, memoryProposedAt, memoryAnswer, ...student }: StudentRow) => {
  const { state, decidesAlone } = memoryConsent({ birthMonth, proposedAt: memoryProposedAt, answer: memoryAnswer }, new Date());
  return {
    ...student,
    birthMonth: birthMonth.slice(0, 7),
    accompanied: isAccompaniedLevel(student.level),
    memory: { proposed: memoryProposedAt !== null, state, decidesAlone },
  };
};

export function createHouseholdService({ repository, createPairingCode }: Deps) {
  const found = async (guardianId: string, studentId: string) => {
    const student = await repository.findStudent(guardianId, studentId);
    if (!student) throw new Problem('NOT_FOUND');
    return toStudent(student);
  };

  return {
    async isStudent(userId: string) {
      return (await repository.roleOf(userId)) === 'student';
    },

    /** A student reaches none of the guardian's routes. */
    async assertNotStudent(userId: string) {
      if ((await repository.roleOf(userId)) === 'student') throw new Problem('FORBIDDEN');
    },

    /** Who is signed in: a student, or else a guardian, whose household may not exist yet. */
    async me(userId: string, name: string) {
      const student = await repository.findProfile(userId);
      return student
        ? { id: userId, name, role: 'student' as const, level: student.level, accompanied: isAccompaniedLevel(student.level) }
        : { id: userId, name, role: 'guardian' as const, level: null, accompanied: false };
    },

    async listStudents(guardianId: string) {
      return (await repository.listStudents(guardianId)).map(toStudent);
    },

    async createStudent(guardianId: string, input: StudentInput) {
      const id = generateId();
      await repository.createStudent(guardianId, {
        id,
        name: input.name,
        email: createPlaceholderEmail({ identifier: id, namespace: 'student' }),
        level: input.level,
        birthMonth: `${input.birthMonth}-01`,
        memoryProposed: input.memoryProposed ?? false,
      });
      return found(guardianId, id);
    },

    async updateStudent(
      guardianId: string,
      studentId: string,
      patch: { name?: string | undefined; level?: SchoolLevel | undefined; memoryProposed?: boolean | undefined },
    ) {
      // From 15 the child decides alone: the guardian neither proposes nor erases it.
      if (patch.memoryProposed !== undefined && (await found(guardianId, studentId)).memory.decidesAlone) throw new Problem('FORBIDDEN');
      if (!(await repository.updateStudent(guardianId, studentId, patch))) throw new Problem('NOT_FOUND');
      return found(guardianId, studentId);
    },

    async pairingCode(guardianId: string, studentId: string) {
      await found(guardianId, studentId);
      return createPairingCode(studentId);
    },

    listOwnDevices(userId: string) {
      return repository.listOwnDevices(userId);
    },

    async listDevices(guardianId: string, studentId: string) {
      await found(guardianId, studentId);
      return repository.listDevices(guardianId, studentId);
    },

    async revokeDevice(guardianId: string, studentId: string, deviceId: string) {
      if (!(await repository.revokeDevice(guardianId, studentId, deviceId))) throw new Problem('NOT_FOUND');
    },

    async deleteStudent(guardianId: string, studentId: string) {
      if (!(await repository.deleteStudent(guardianId, studentId))) throw new Problem('NOT_FOUND');
    },
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
