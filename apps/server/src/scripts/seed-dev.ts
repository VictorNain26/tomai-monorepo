/**
 * Deterministic dev seed: one parent + one linked child (autonomous login),
 * with known credentials. Verify-then-repair guarantees the end state and
 * PROVES both real logins. Refuses to run in production.
 *
 * Usage: cd apps/server && bun run seed
 */

import { isProduction } from '../config/env';
import { auth } from '../lib/auth';
import { usersRepository } from '../db/repositories';
import { parentChildRepository } from '../db/repositories/parent-child.repository';
import type { SchoolLevel } from '../db/schema.js';

const SEED = {
  parentEmail: 'dev.parent@tomai.local',
  parentPassword: 'DevParent123!',
  parentName: 'Dev Parent',
  childUsername: 'dev.eleve',
  childPassword: 'DevEleve123!',
  childName: 'Dev Eleve',
  childSchoolLevel: 'troisieme',
};

async function canLoginEmail(email: string, password: string): Promise<boolean> {
  try {
    const result = await auth.api.signInEmail({ body: { email, password } });
    return !!result?.user?.id;
  } catch {
    return false;
  }
}

async function canLoginUsername(username: string, password: string): Promise<boolean> {
  try {
    const result = await auth.api.signInUsername({ body: { username, password } });
    return !!result?.user?.username;
  } catch {
    return false;
  }
}

export async function seedDev(): Promise<{ parentId: string; childId: string }> {
  if (isProduction()) {
    throw new Error('[seed] refusing to run in production');
  }

  const existingParent = await usersRepository.findByEmail(SEED.parentEmail);
  const existingChild = await usersRepository.findByUsername(SEED.childUsername);

  const healthy =
    !!existingParent &&
    !!existingChild &&
    (await canLoginEmail(SEED.parentEmail, SEED.parentPassword)) &&
    (await canLoginUsername(SEED.childUsername, SEED.childPassword));

  if (healthy && existingParent && existingChild) {
    return { parentId: existingParent.id, childId: existingChild.id };
  }

  // Not healthy — wipe and recreate from scratch.
  if (existingParent) await usersRepository.deleteById(existingParent.id);
  if (existingChild) await usersRepository.deleteById(existingChild.id);

  const parent = await auth.api.signUpEmail({
    body: { email: SEED.parentEmail, password: SEED.parentPassword, name: SEED.parentName },
  });
  await usersRepository.update(parent.user.id, { role: 'parent', firstName: 'Dev', lastName: 'Parent' });

  const childBody = {
    email: `child_${Date.now()}_${Math.random().toString(36).substring(7)}@internal.tomai`,
    password: SEED.childPassword,
    name: SEED.childName,
  };
  const child = await auth.api.signUpEmail({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { ...childBody, username: SEED.childUsername } as typeof childBody & Record<string, any>,
  });
  await usersRepository.update(child.user.id, {
    firstName: 'Dev',
    lastName: 'Eleve',
    username: SEED.childUsername,
    displayUsername: SEED.childUsername,
    role: 'student',
    schoolLevel: SEED.childSchoolLevel as SchoolLevel,
  });
  await parentChildRepository.link(parent.user.id, child.user.id);

  // Prove both logins — throw on failure so the seed is never a false positive.
  const parentOk = await canLoginEmail(SEED.parentEmail, SEED.parentPassword);
  if (!parentOk) throw new Error('[seed] parent login proof failed');
  const childOk = await canLoginUsername(SEED.childUsername, SEED.childPassword);
  if (!childOk) throw new Error('[seed] child login proof failed');

  return { parentId: parent.user.id, childId: child.user.id };
}

// CLI entry-point — only runs when this file is executed directly.
if (import.meta.main) {
  const result = await seedDev();
  console.log(
    `[seed] OK — parentId=${result.parentId} childId=${result.childId} | parent:dev.parent@tomai.local / DevParent123! | child:dev.eleve / DevEleve123!`,
  );
  process.exit(0);
}
