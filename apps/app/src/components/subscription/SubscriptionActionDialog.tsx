/**
 * SubscriptionActionDialog - Dialog de confirmation pour actions premium
 */

import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPeriodEnd, type IAddChildrenPreview } from '@/lib/subscription';
import type { IChild } from '@/types';

export type ActionType = 'add' | 'remove' | 'reactivate' | null;

export interface SubscriptionActionDialogProps {
  type: ActionType;
  child: IChild | undefined;
  currentPeriodEnd: string | null;
  premiumChildrenCount: number;
  isLoading: boolean;
  isLoadingProrata: boolean;
  prorataPreview: IAddChildrenPreview | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function SubscriptionActionDialog({
  type,
  child,
  currentPeriodEnd,
  premiumChildrenCount,
  isLoading,
  isLoadingProrata,
  prorataPreview,
  onConfirm,
  onClose,
}: SubscriptionActionDialogProps): ReactElement {
  return (
    <Dialog open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg sm:text-xl">
            {type === 'add' && `Ajouter ${child?.firstName} ?`}
            {type === 'remove' && `Retirer ${child?.firstName} ?`}
            {type === 'reactivate' && `Réactiver ${child?.firstName} ?`}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base pt-2">
            {type === 'add' && (
              <span className="block space-y-2">
                {isLoadingProrata ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calcul du montant...
                  </span>
                ) : prorataPreview ? (
                  <>
                    <span className="block">
                      Facturation immédiate : <strong className="text-foreground">{prorataPreview.prorata.amount}</strong>
                      <span className="text-muted-foreground"> (prorata {prorataPreview.prorata.daysRemaining}j)</span>
                    </span>
                    <span className="block">
                      Puis <strong className="text-foreground">{prorataPreview.newSubscription.monthlyAmount}/mois</strong>
                    </span>
                  </>
                ) : (
                  'Erreur de calcul du montant'
                )}
              </span>
            )}
            {type === 'remove' && currentPeriodEnd && (
              <span className="block">
                {child?.firstName} conserve l'accès Premium jusqu'au{' '}
                <strong className="text-foreground">{formatPeriodEnd(currentPeriodEnd)}</strong>.
                {premiumChildrenCount <= 1 && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    L'abonnement prendra fin à cette date.
                  </span>
                )}
              </span>
            )}
            {type === 'reactivate' && (
              <span className="block">
                Le retrait prévu de {child?.firstName} sera annulé.
                <span className="block mt-1 text-green-600 dark:text-green-400">
                  L'abonnement continuera normalement sans frais supplémentaires.
                </span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Annuler
          </Button>
          <Button
            variant={type === 'remove' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading || (type === 'add' && isLoadingProrata)}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isLoading ? 'En cours...' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
