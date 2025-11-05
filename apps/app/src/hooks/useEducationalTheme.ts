/**
 * Hook de gestion automatique des thèmes éducatifs
 * Applique dynamiquement les couleurs parent/étudiant selon le rôle utilisateur
 * Intégration avec le design system ShadCN éducatif
 */

import { useEffect } from 'react';
import { useUser } from '@/lib/auth';
import { useTheme } from '@/components/theme-provider';

interface UserWithRole {
  role?: 'parent' | 'student' | 'admin';
}

export function useEducationalTheme() {
  const user = useUser() as UserWithRole;
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;

    // Nettoie les classes de thème précédentes
    root.classList.remove('theme-parent', 'theme-student');

    // Applique le thème selon le rôle utilisateur
    if (user?.role === 'parent') {
      root.classList.add('theme-parent');
    } else if (user?.role === 'student') {
      root.classList.add('theme-student');
    }
  }, [user, theme]);

  // Retourne des infos utiles sur le thème actif
  return {
    currentTheme: user?.role === 'parent' ? 'parent' : user?.role === 'student' ? 'student' : 'default',
    isParentTheme: user?.role === 'parent',
    isStudentTheme: user?.role === 'student',
    themeClass: user?.role === 'parent' ? 'theme-parent' : user?.role === 'student' ? 'theme-student' : ''
  };
}
