/**
 * The household: a guardian and the students they created. A user belongs to one household at
 * most. A student's first name or pseudonym is `user.name`; the profile holds no family name, only
 * the level and the month of birth (GDPR art. 5.1.c, data minimisation).
 */

import { sql } from 'drizzle-orm';
import { check, date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SCHOOL_LEVELS } from '../../domain/levels';
import { user } from '../../platform/auth/schema';

export const memberRole = pgEnum('household_member_role', ['guardian', 'student']);
export const schoolLevel = pgEnum('school_level', SCHOOL_LEVELS);
export const memoryAnswer = pgEnum('memory_answer', ['accepted', 'declined']);

export const household = pgTable('household', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdMember = pgTable(
  'household_member',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('household_member_household_id_idx').on(table.householdId)],
);

export const studentProfile = pgTable(
  'student_profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    level: schoolLevel('level').notNull(),
    // The first day of the month: the day of birth is not collected.
    birthMonth: date('birth_month', { mode: 'string' }).notNull(),
    // The learner memory (domain/memory-consent.ts): the parent's proposal, the child's answer, and
    // the last reset, before which no exercise counts.
    memoryProposedAt: timestamp('memory_proposed_at', { withTimezone: true }),
    memoryAnswer: memoryAnswer('memory_answer'),
    memoryResetAt: timestamp('memory_reset_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('student_profile_birth_month_first_day', sql`extract(day from ${table.birthMonth}) = 1`)],
);
