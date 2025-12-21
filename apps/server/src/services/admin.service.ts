/**
 * Admin Service - User Management
 * 5 CRUD operations complets sans code mort
 */

import { db } from '../db/connection';
import { user } from '../db/schema';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import type { User, SchoolLevel, UserRole } from '../db/schema';
import { auth } from '../lib/auth';

// Types pour l'API
export interface ListUsersFilters {
  page?: number;
  perPage?: number;
  q?: string; // search query
  role?: UserRole;
  isActive?: boolean;
}

export interface ListUsersResponse {
  data: User[];
  total: number;
}

export interface CreateUserData {
  email: string;
  name: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  schoolLevel?: SchoolLevel;
  dateOfBirth?: string;
  parentId?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
  schoolLevel?: SchoolLevel;
  dateOfBirth?: string;
  parentId?: string;
}

/**
 * Liste tous les utilisateurs avec pagination et filtres
 */
export async function listUsers(filters: ListUsersFilters): Promise<ListUsersResponse> {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 25;
  const offset = (page - 1) * perPage;

  // Construction des conditions WHERE
  const conditions = [];

  // Recherche textuelle sur email, name, username
  if (filters.q) {
    conditions.push(
      or(
        ilike(user.email, `%${filters.q}%`),
        ilike(user.name, `%${filters.q}%`),
        ilike(user.username, `%${filters.q}%`)
      )
    );
  }

  // Filtre par rôle
  if (filters.role) {
    conditions.push(eq(user.role, filters.role));
  }

  // Filtre par statut actif
  if (filters.isActive !== undefined) {
    conditions.push(eq(user.isActive, filters.isActive));
  }

  // Requêtes parallèles pour performance
  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(user)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(user.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  return {
    data,
    total: countResult[0].count,
  };
}

/**
 * Récupère un utilisateur par ID
 */
export async function getUserById(userId: string): Promise<User> {
  const [userData] = await db.select().from(user).where(eq(user.id, userId));

  if (!userData) {
    throw new Error('User not found');
  }

  return userData;
}

/**
 * Crée un nouvel utilisateur (admin bypass email verification)
 * Better Auth crée l'utilisateur avec role:user, puis on met à jour avec notre rôle custom
 */
export async function createUser(data: CreateUserData): Promise<User> {
  // Étape 1: Better Auth crée l'utilisateur avec ID auto-généré
  const result = await auth.api.createUser({
    body: {
      email: data.email,
      name: data.name,
      password: crypto.randomUUID(), // Mot de passe temporaire aléatoire
      role: 'user', // Better Auth accepte seulement 'user' ou 'admin'
    }
  });

  // Étape 2: Mise à jour avec nos champs custom (role, schoolLevel, etc.)
  const [updated] = await db
    .update(user)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role, // Notre rôle custom: 'student' | 'parent' | 'admin'
      schoolLevel: data.schoolLevel, // Drizzle accepte undefined pour champs optionnels
      dateOfBirth: data.dateOfBirth,
      parentId: data.parentId,
      isActive: true,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, result.user.id))
    .returning();

  return updated;
}

/**
 * Met à jour un utilisateur existant
 */
export async function updateUser(userId: string, data: UpdateUserData): Promise<User> {
  const [updated] = await db
    .update(user)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning();

  if (!updated) {
    throw new Error('User not found');
  }

  return updated;
}

/**
 * Supprime un utilisateur (soft delete)
 * Note: Les sessions existantes seront bloquées au prochain check via isActive=false
 */
export async function deleteUser(userId: string): Promise<User> {
  // Soft delete - isActive=false bloquera automatiquement l'accès
  const [deleted] = await db
    .update(user)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning();

  if (!deleted) {
    throw new Error('User not found');
  }

  return deleted;
}
