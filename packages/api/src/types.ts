/**
 * @repo/api - Shared Types
 *
 * Platform-agnostic types used by both Web and Mobile.
 */

export interface IAppUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: 'parent' | 'student';
  schoolLevel?: string;
  parentId?: string;
  selectedLv2?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
