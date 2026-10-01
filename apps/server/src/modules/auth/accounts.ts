import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { auth } from '../../platform/auth/auth';
import { db } from '../../db/connection';
import { account, type SchoolLevel } from './auth.schema.js';
import { usersRepository } from './users.repository.js';

interface StudentAccountInput {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  schoolLevel: SchoolLevel;
  dateOfBirth: string;
}

export async function createStudentAccount(input: StudentAccountInput): Promise<string> {
  // The username plugin augments signUpEmail at runtime but TS overloads
  // don't reflect it yet — cast only the `username` addition; the other
  // fields remain fully typed so typos in email/password/name are still caught.
  const typedBody = {
    email: `child_${Date.now()}_${Math.random().toString(36).substring(7)}@internal.tomai`,
    password: input.password,
    name: `${input.firstName} ${input.lastName}`.trim(),
  };
  const result = await auth.api.signUpEmail({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { ...typedBody, username: input.username } as typeof typedBody & Record<string, any>,
  });

  try {
    await usersRepository.update(result.user.id, {
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      displayUsername: input.username,
      role: 'student',
      schoolLevel: input.schoolLevel,
      dateOfBirth: input.dateOfBirth,
    });
  } catch (err) {
    await usersRepository.deleteById(result.user.id);
    throw err;
  }

  return result.user.id;
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const hashedPassword = await hashPassword(password);
  await db.update(account)
    .set({ password: hashedPassword })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
}
