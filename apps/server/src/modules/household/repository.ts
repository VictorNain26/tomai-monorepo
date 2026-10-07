/**
 * The only file of the module that touches the database. A guardian reaches a student through
 * `studentsOf`, a clause of the query itself, never a comparison after a read
 * (OWASP Authorization Cheat Sheet): a student of another household is simply not found.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { SchoolLevel } from '../../domain/levels';
import { account, session, user } from '../../platform/auth/schema';
import type { Db } from '../../platform/db/client';
import { household, householdMember, studentProfile } from './schema';

export interface NewStudent {
  id: string;
  name: string;
  email: string;
  username: string;
  displayUsername: string;
  passwordHash: string;
  level: SchoolLevel;
  birthMonth: string;
}

const guardian = alias(householdMember, 'guardian');

export function createHouseholdRepository(db: Db) {
  /** The ids of the students in the household where `guardianId` is a guardian. */
  const studentsOf = (guardianId: string) =>
    db
      .select({ id: householdMember.userId })
      .from(householdMember)
      .innerJoin(guardian, and(eq(guardian.householdId, householdMember.householdId), eq(guardian.userId, guardianId), eq(guardian.role, 'guardian')))
      .where(eq(householdMember.role, 'student'));

  const studentColumns = {
    id: user.id,
    name: user.name,
    username: user.displayUsername,
    level: studentProfile.level,
    birthMonth: studentProfile.birthMonth,
  };

  return {
    async roleOf(userId: string) {
      const [member] = await db.select({ role: householdMember.role }).from(householdMember).where(eq(householdMember.userId, userId));
      return member?.role;
    },

    async listStudents(guardianId: string) {
      return db
        .select(studentColumns)
        .from(user)
        .innerJoin(studentProfile, eq(studentProfile.userId, user.id))
        .where(inArray(user.id, studentsOf(guardianId)))
        .orderBy(user.createdAt);
    },

    async findStudent(guardianId: string, studentId: string) {
      const [student] = await db
        .select(studentColumns)
        .from(user)
        .innerJoin(studentProfile, eq(studentProfile.userId, user.id))
        .where(and(eq(user.id, studentId), inArray(user.id, studentsOf(guardianId))));
      return student;
    },

    /**
     * The student, their password and their profile, in the guardian's household, which is created
     * with the first student. `false` when the username is taken: nothing is written then.
     */
    async createStudent(guardianId: string, student: NewStudent) {
      return db.transaction(async (tx) => {
        // Serialises a guardian's concurrent creations: one household, never two.
        await tx.select({ id: user.id }).from(user).where(eq(user.id, guardianId)).for('update');

        const [created] = await tx
          .insert(user)
          .values({
            id: student.id,
            name: student.name,
            email: student.email,
            username: student.username,
            displayUsername: student.displayUsername,
          })
          .onConflictDoNothing({ target: user.username })
          .returning({ id: user.id });
        if (!created) return false;

        await tx.insert(account).values({
          id: crypto.randomUUID(),
          userId: student.id,
          accountId: student.id,
          providerId: 'credential',
          password: student.passwordHash,
        });

        const [member] = await tx
          .select({ householdId: householdMember.householdId })
          .from(householdMember)
          .where(and(eq(householdMember.userId, guardianId), eq(householdMember.role, 'guardian')));
        let householdId = member?.householdId;
        if (!householdId) {
          const [home] = await tx.insert(household).values({}).returning({ id: household.id });
          householdId = home?.id;
          if (!householdId) throw new Error('The household insert returned no row');
          await tx.insert(householdMember).values({ userId: guardianId, householdId, role: 'guardian' });
        }
        await tx.insert(householdMember).values({ userId: student.id, householdId, role: 'student' });
        await tx.insert(studentProfile).values({ userId: student.id, level: student.level, birthMonth: student.birthMonth });
        return true;
      });
    },

    /** `false` when the student is not in the guardian's household. */
    async updateStudent(guardianId: string, studentId: string, patch: { name?: string | undefined; level?: SchoolLevel | undefined }) {
      return db.transaction(async (tx) => {
        const [found] = await tx
          .update(user)
          .set({ updatedAt: new Date(), ...(patch.name === undefined ? {} : { name: patch.name }) })
          .where(and(eq(user.id, studentId), inArray(user.id, studentsOf(guardianId))))
          .returning({ id: user.id });
        if (!found) return false;
        if (patch.level !== undefined) {
          await tx.update(studentProfile).set({ level: patch.level, updatedAt: new Date() }).where(eq(studentProfile.userId, studentId));
        }
        return true;
      });
    },

    /** The new password, and every session of the student ended. `false` when not in the household. */
    async setStudentPassword(guardianId: string, studentId: string, passwordHash: string) {
      return db.transaction(async (tx) => {
        const [found] = await tx
          .update(account)
          .set({ password: passwordHash, updatedAt: new Date() })
          .where(and(eq(account.userId, studentId), eq(account.providerId, 'credential'), inArray(account.userId, studentsOf(guardianId))))
          .returning({ id: account.id });
        if (!found) return false;
        await tx.delete(session).where(eq(session.userId, studentId));
        return true;
      });
    },

    /** The student's account, sessions, membership and profile go with the user row (ON DELETE CASCADE). */
    async deleteStudent(guardianId: string, studentId: string) {
      const deleted = await db
        .delete(user)
        .where(and(eq(user.id, studentId), inArray(user.id, studentsOf(guardianId))))
        .returning({ id: user.id });
      return deleted.length > 0;
    },
  };
}

export type HouseholdRepository = ReturnType<typeof createHouseholdRepository>;
