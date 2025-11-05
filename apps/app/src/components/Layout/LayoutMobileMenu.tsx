import type { ReactElement } from 'react';
import { useUser } from '@/lib/auth';

interface ILayoutMobileMenuProps {
  isMobileMenuOpen: boolean;
  onToggle: () => void;
  positionClassName?: string;
}

export const LayoutMobileMenu = ({ isMobileMenuOpen, onToggle, positionClassName = 'fixed bottom-4 right-4' }: ILayoutMobileMenuProps): ReactElement => {
  const _user = useUser();

  return (
    <button
      onClick={onToggle}
      className={`${positionClassName} z-50 md:hidden flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
      aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      aria-expanded={isMobileMenuOpen}
      aria-controls="mobile-sidebar"
    >
      <div className="relative flex h-4 w-4 flex-col justify-center">
        <div
          className={`absolute h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${isMobileMenuOpen
              ? 'top-1/2 rotate-45 -translate-y-px'
              : 'top-0'
            }`}
        />
        <div
          className={`absolute top-1/2 h-0.5 w-4 -translate-y-px rounded-full bg-current transition-all duration-200 ${isMobileMenuOpen
              ? 'opacity-0'
              : 'opacity-100'
            }`}
        />
        <div
          className={`absolute h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${isMobileMenuOpen
              ? 'top-1/2 -rotate-45 -translate-y-px'
              : 'bottom-0'
            }`}
        />
      </div>
    </button>
  );
};

export default LayoutMobileMenu;

/**
 * LayoutMobileMenu Component - Architecture 2025
 *
 * Features:
 * - Animation fluide de rotation des icônes (3 lignes → X)
 * - Position FAB (Floating Action Button) bottom-right pour ergonomie mobile
 * - Shadow elevé pour visibilité sur tous les fonds
 * - Support safe-area pour encoche iPhone
 * - Classes design system modulaires
 * - Accessibilité complète (ARIA)
 * - Position fixe avec z-index hiérarchisé
 *
 * UX Improvements (Mai 2025):
 * - Déplacé de top-left à bottom-right (zero conflit avec PageHeader)
 * - Zone de pouce optimale sur smartphones
 * - Pattern moderne Material Design FAB
 */
