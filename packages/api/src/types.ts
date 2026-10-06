/**
 * @repo/api - Shared Types
 *
 * Platform-agnostic types shared by the clients.
 */

export type { TomChatMessage, TomDataParts, DeckCreatedData } from 'tomai-server/app';

/** Utilisateur applicatif, miroir de l'enum PostgreSQL `user_role`. */
export interface IAppUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: 'parent' | 'student';
  schoolLevel?: string;
  createdAt: Date;
  updatedAt: Date;
}
