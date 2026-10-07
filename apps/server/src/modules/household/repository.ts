/**
 * The only file of the module that touches the database. A guardian reaches a student through
 * `studentsOf`, a clause of the query itself, never a comparison after a read
 * (OWASP Authorization Cheat Sheet): a student of another household is simply not found.
 */

import { and, desc, eq, gt, inArray, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { SchoolLevel } from '../../domain/levels';
import { session, user } from '../../platform/auth/schema';
import type { Db } from '../../platform/db/client';
import { household, householdMember, studentProfile } from './schema';

export interface NewStudent {
  id: string;
  name: string;
  email: string;
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
    level: studentProfile.level,
    birthMonth: studentProfile.birthMonth,
  };

  return {
    async roleOf(userId: string) {
      const [member] = await db.select({ role: householdMember.role }).from(householdMember).where(eq(householdMember.userId, userId));
      return member?.role;
    },

    /** A student's own profile; undefined for anyone who is not a student. */
    async findProfile(studentId: string) {
      const [student] = await db
        .select({ id: user.id, name: user.name, level: studentProfile.level })
        .from(user)
        .innerJoin(studentProfile, eq(studentProfile.userId, user.id))
        .innerJoin(householdMember, and(eq(householdMember.userId, user.id), eq(householdMember.role, 'student')))
        .where(eq(user.id, studentId));
      return student;
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

    /** The student and their profile, in the guardian's household, which is created with the first student. */
    async createStudent(guardianId: string, student: NewStudent) {
      await db.transaction(async (tx) => {
        // Serialises a guardian's concurrent creations: one household, never two.
        await tx.select({ id: user.id }).from(user).where(eq(user.id, guardianId)).for('update');

        await tx.insert(user).values({ id: student.id, name: student.name, email: student.email });

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

    /** A device is a live session: when it was paired and its browser; never its token nor its address. */
    async listDevices(guardianId: string, studentId: string) {
      return db
        .select({ id: session.id, pairedAt: session.createdAt, userAgent: session.userAgent })
        .from(session)
        .where(and(eq(session.userId, studentId), gt(session.expiresAt, new Date()), inArray(session.userId, studentsOf(guardianId))))
        .orderBy(desc(session.createdAt));
    },

    /** `false` when no such device of a student of the guardian's household. */
    async revokeDevice(guardianId: string, studentId: string, deviceId: string) {
      const revoked = await db
        .delete(session)
        .where(and(eq(session.id, deviceId), eq(session.userId, studentId), inArray(session.userId, studentsOf(guardianId))))
        .returning({ id: session.id });
      return revoked.length > 0;
    },

    /**
     * A user's deletion, in one transaction: a sole guardian takes their household and its students
     * with them (the students' sessions, memberships and profiles by ON DELETE CASCADE), a guardian
     * among others leaves the household. Locks the user row, as createStudent does: a student
     * created meanwhile waits, then finds no guardian.
     */
    async deleteAccount(userId: string) {
      await db.transaction(async (tx) => {
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
        const [member] = await tx
          .select({ householdId: householdMember.householdId })
          .from(householdMember)
          .where(and(eq(householdMember.userId, userId), eq(householdMember.role, 'guardian')));
        if (member) {
          const others = await tx
            .select({ userId: householdMember.userId })
            .from(householdMember)
            .where(
              and(eq(householdMember.householdId, member.householdId), eq(householdMember.role, 'guardian'), ne(householdMember.userId, userId)),
            );
          if (others.length === 0) {
            await tx.delete(user).where(inArray(user.id, studentsOf(userId)));
            await tx.delete(household).where(eq(household.id, member.householdId));
          }
        }
        await tx.delete(user).where(eq(user.id, userId));
      });
    },

    /** The student's sessions, membership and profile go with the user row (ON DELETE CASCADE). */
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
