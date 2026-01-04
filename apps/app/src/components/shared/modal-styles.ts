/**
 * Modal CSS Styles - Constantes standardisées pour les modals
 *
 * Single source of truth pour les classes CSS des modals.
 * Utilisé par BaseModal et les modals multi-step qui ne peuvent pas utiliser BaseModal directement.
 */

/**
 * Classes CSS standards pour les modals
 * À utiliser avec `cn()` pour combiner avec d'autres classes
 */
export const modalStyles = {
  /** DialogContent avec structure flex complète */
  content: 'flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0',
  /** Variantes de taille */
  sizes: {
    default: 'sm:max-w-lg',
    compact: 'sm:max-w-md',
    wide: 'sm:max-w-xl',
  },
  /** Header standard */
  header: 'flex-shrink-0 border-b px-4 py-4 sm:px-6',
  /** Footer standard */
  footer: 'flex-shrink-0 flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:px-6',
  /** Contenu scrollable avec padding */
  scrollContent: 'px-4 py-4 sm:px-6',
} as const;

export type ModalVariant = 'default' | 'compact' | 'wide';
