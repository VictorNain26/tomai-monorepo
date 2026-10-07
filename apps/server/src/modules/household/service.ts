/**
 * What a guardian does with the students of their household. A student has no email: their
 * address is the non-routable one better-auth itself makes for an account without one (RFC 6761
 * `.invalid`), and they sign in by username.
 */

import { createPlaceholderEmail } from '@better-auth/core/utils/email';
import { generateId } from '@better-auth/core/utils/id';
import type { SchoolLevel } from '../../domain/levels';
import { Problem } from '../../platform/http/problem';
import type { HouseholdRepository } from './repository';

export interface StudentInput {
  name: string;
  username: string;
  password: string;
  level: SchoolLevel;
  birthMonth: string;
}

interface Deps {
  repository: HouseholdRepository;
  hashPassword: (password: string) => Promise<string>;
}

type StudentRow = NonNullable<Awaited<ReturnType<HouseholdRepository['findStudent']>>>;

// The date column holds the first day of the month; the API speaks in YYYY-MM.
const toStudent = ({ birthMonth, ...student }: StudentRow) => ({ ...student, birthMonth: birthMonth.slice(0, 7) });

export function createHouseholdService({ repository, hashPassword }: Deps) {
  const found = async (guardianId: string, studentId: string) => {
    const student = await repository.findStudent(guardianId, studentId);
    if (!student) throw new Problem('NOT_FOUND');
    return toStudent(student);
  };

  return {
    /** A student reaches none of the guardian's routes. */
    async assertNotStudent(userId: string) {
      if ((await repository.roleOf(userId)) === 'student') throw new Problem('FORBIDDEN');
    },

    async listStudents(guardianId: string) {
      return (await repository.listStudents(guardianId)).map(toStudent);
    },

    async createStudent(guardianId: string, input: StudentInput) {
      const id = generateId();
      const created = await repository.createStudent(guardianId, {
        id,
        name: input.name,
        email: createPlaceholderEmail({ identifier: id, namespace: 'student' }),
        // The username plugin's own normalisation, so that /sign-in/username finds it.
        username: input.username.toLowerCase(),
        displayUsername: input.username,
        passwordHash: await hashPassword(input.password),
        level: input.level,
        birthMonth: `${input.birthMonth}-01`,
      });
      if (!created) throw new Problem('USERNAME_TAKEN');
      return found(guardianId, id);
    },

    async updateStudent(guardianId: string, studentId: string, patch: { name?: string | undefined; level?: SchoolLevel | undefined }) {
      if (!(await repository.updateStudent(guardianId, studentId, patch))) throw new Problem('NOT_FOUND');
      return found(guardianId, studentId);
    },

    async setStudentPassword(guardianId: string, studentId: string, password: string) {
      if (!(await repository.setStudentPassword(guardianId, studentId, await hashPassword(password)))) throw new Problem('NOT_FOUND');
    },

    async deleteStudent(guardianId: string, studentId: string) {
      if (!(await repository.deleteStudent(guardianId, studentId))) throw new Problem('NOT_FOUND');
    },
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
