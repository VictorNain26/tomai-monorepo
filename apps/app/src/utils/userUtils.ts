import type { IAppUser, UserRoleType } from '@/types';

/**
 * Obtient le nom d'affichage pour l'utilisateur
 * @param user - L'utilisateur
 * @returns Le nom d'affichage préféré
 */
export const getUserDisplayName = (user: IAppUser | null): string => {
  if (!user) return 'Utilisateur';

  // Pour les parents, prioriser l'email (plus lisible)
  if (user.role === 'parent') {
    const email = user.email?.trim();
    if (email && email !== '') {
      return email;
    }

    const username = user.username?.trim();
    if (username && username !== '') {
      return username;
    }

    // Fallback to name if available
    const name = user.name?.trim();
    if (name && name !== '') {
      return name;
    }
  }

  // Pour les étudiants, prioriser le prénom puis le username puis l'email
  if (user.role === 'student') {
    const firstName = user.firstName?.trim();
    if (firstName && firstName !== '') {
      return firstName;
    }

    const username = user.username?.trim();
    if (username && username !== '') {
      return username;
    }

    const email = user.email?.trim();
    if (email && email !== '') {
      return email;
    }

    // Fallback to name if available
    const name = user.name?.trim();
    if (name && name !== '') {
      return name;
    }
  }

  // Fallback pour autres rôles
  const name = user.name?.trim();
  if (name && name !== '') {
    return name;
  }

  const email = user.email?.trim();
  if (email && email !== '') {
    return email;
  }

  return 'Utilisateur';
};

/**
 * Obtient le libellé du rôle utilisateur
 * @param role - Le rôle de l'utilisateur
 * @returns Le libellé traduit
 */
export const getUserRoleLabel = (role: UserRoleType | string | undefined): string => {
  if (!role) return 'Utilisateur';
  const roleLabels: Record<string, string> = {
    parent: 'Parent/Tuteur',
    student: 'Étudiant/Élève',
    admin: 'Administrateur'
  };

  return roleLabels[role] ?? 'Utilisateur';
};

/**
 * Vérifie si l'utilisateur a un niveau scolaire défini
 * @param user - L'utilisateur
 * @returns true si le niveau est défini
 */
export const hasSchoolLevel = (user: IAppUser | null): boolean => {
  return user?.schoolLevel != null && user?.schoolLevel?.trim() !== '';
};
