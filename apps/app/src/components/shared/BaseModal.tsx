/**
 * BaseModal - Composant modal standardisé
 *
 * Single source of truth pour tous les modals de l'application.
 * Uniformise : structure, padding, animations, responsive design.
 *
 * Modes :
 * - form : Le contenu est un formulaire avec submit dans le footer
 * - default : Contenu libre avec footer optionnel
 *
 * Variantes de taille :
 * - default (sm:max-w-lg) : Formulaires standards
 * - compact (sm:max-w-md) : Modals simples, confirmations
 * - wide (sm:max-w-xl) : Contenu large
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { modalStyles, type ModalVariant } from './modal-styles';

interface BaseModalProps {
  /** Contrôle l'ouverture du modal */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Titre du modal */
  title: React.ReactNode;
  /** Description optionnelle sous le titre */
  description?: string;
  /** Contenu scrollable du modal */
  children: React.ReactNode;
  /** Contenu du footer (boutons) */
  footer?: React.ReactNode;
  /** Variante de taille */
  variant?: ModalVariant;
  /** Désactiver la fermeture (pendant loading) */
  preventClose?: boolean;
  /** Afficher le bouton X de fermeture (default: true) */
  showCloseButton?: boolean;
  /** Désactiver le padding du contenu (pour formulaires custom) */
  noPadding?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'default',
  preventClose = false,
  showCloseButton = true,
  noPadding = false,
}: BaseModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && !preventClose) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(modalStyles.content, modalStyles.sizes[variant])}
        showCloseButton={showCloseButton && !preventClose}
      >
        {/* Header standardisé */}
        <DialogHeader className={modalStyles.header}>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Contenu scrollable */}
        <ScrollArea className="flex-1 overflow-auto">
          {noPadding ? (
            children
          ) : (
            <div className={modalStyles.scrollContent}>
              {children}
            </div>
          )}
        </ScrollArea>

        {/* Footer standardisé (optionnel) */}
        {footer && (
          <DialogFooter className={modalStyles.footer}>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BaseModal;
