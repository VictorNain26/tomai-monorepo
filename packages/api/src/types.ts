/**
 * @repo/api - Shared Types
 *
 * Platform-agnostic types shared by the clients.
 */

export type { TomChatMessage, TomDataParts, DeckCreatedData } from 'tomai-server/app';

/**
 * Utilisateur applicatif — source unique du contrat, miroir de l'enum
 * PostgreSQL `user_role` ('parent' | 'student' | 'admin'). `admin` existe via
 * le plugin Better Auth admin (Quick Switch) : tout consommateur doit le
 * traiter explicitement (cf. `resolveWebRole` côté web), jamais le présumer
 * absent.
 */
export interface IAppUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: 'parent' | 'student' | 'admin';
  schoolLevel?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}
