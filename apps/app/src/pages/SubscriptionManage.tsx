/**
 * SubscriptionManage - Simplified subscription management page
 *
 * Simple workflow:
 * - View subscription info
 * - Each child has individual action (add/remove from premium)
 * - Cancel/resume subscription
 * - Stripe portal for billing
 */

import { type ReactElement, useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Crown,
  Plus,
  Minus,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubscription } from '@/hooks/useSubscription';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';
import {
  PRICING_INFO,
  formatPriceEuros,
  formatPeriodEnd,
  isPremiumActive,
  isCanceledButActive,
  previewAddChildren,
  type IAddChildrenPreview,
} from '@/lib/subscription';
import { useUser } from '@/lib/auth';
import type { IChild } from '@/types';

// ============================================
// Types
// ============================================

type ActionType = 'add' | 'remove' | 'resume' | null;

interface ConfirmDialogState {
  type: ActionType;
  child?: IChild;
}

// ============================================
// Main Component
// ============================================

export default function SubscriptionManage(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const {
    status,
    isLoading,
    addChildren,
    isAddingChildren,
    removeChildren,
    isRemovingChildren,
    openPortal,
    isOpeningPortal,
    resumeSubscription,
    isResuming,
    refetch,
  } = useSubscription();
  const { children, isLoading: isLoadingChildren } = useParentDataQuery();

  // Single dialog state for all confirmations
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ type: null });

  // Prorata preview for add action
  const [prorataPreview, setProrataPreview] = useState<IAddChildrenPreview | null>(null);
  const [isLoadingProrata, setIsLoadingProrata] = useState(false);

  // Derived state from Stripe
  const isPremium = status ? isPremiumActive(status) : false;
  const isCanceled = status ? isCanceledButActive(status) : false;
  const premiumChildrenCount = status?.billing?.premiumChildrenCount ?? 0;
  const currentPeriodEnd = status?.subscription?.currentPeriodEnd ?? null;

  // Get child status from Stripe
  const getChildStatus = useCallback(
    (childId: string) => {
      const childStatus = status?.children?.find((c) => c.id === childId);
      return {
        isPremium: childStatus?.plan === 'premium',
        isPendingRemoval: childStatus?.status === 'pending_removal',
      };
    },
    [status?.children]
  );

  // Calculate new price after action
  const newPriceAfterAction = useMemo(() => {
    if (!confirmDialog.type || !confirmDialog.child) return null;
    const delta = confirmDialog.type === 'add' ? 1 : -1;
    const newCount = Math.max(0, premiumChildrenCount + delta);
    return PRICING_INFO.calculateTotal(newCount);
  }, [confirmDialog, premiumChildrenCount]);

  // Fetch prorata when opening add dialog
  useEffect(() => {
    if (confirmDialog.type !== 'add' || !user?.id) {
      setProrataPreview(null);
      return;
    }

    let cancelled = false;
    setIsLoadingProrata(true);

    previewAddChildren(user.id, 1)
      .then((preview) => {
        if (!cancelled) setProrataPreview(preview);
      })
      .catch(() => {
        if (!cancelled) setProrataPreview(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProrata(false);
      });

    return () => {
      cancelled = true;
    };
  }, [confirmDialog.type, user?.id]);

  // Handlers
  const handleGoBack = useCallback(() => void navigate(-1), [navigate]);
  const handleGoToPricing = useCallback(() => void navigate('/subscription/pricing'), [navigate]);
  const closeDialog = useCallback(() => setConfirmDialog({ type: null }), []);

  const handleOpenPortal = useCallback(async () => {
    try {
      await openPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    }
  }, [openPortal]);

  const handleConfirmAction = useCallback(async () => {
    const { type, child } = confirmDialog;
    if (!type) return;

    try {
      switch (type) {
        case 'add':
          if (child) {
            await addChildren([child.id]);
            toast.success(`${child.firstName} est maintenant Premium`);
          }
          break;
        case 'remove':
          if (child) {
            await removeChildren([child.id]);
            toast.success(`${child.firstName} sera retiré à la fin de la période`);
          }
          break;
        case 'resume':
          await resumeSubscription();
          toast.success("Abonnement réactivé");
          break;
      }
      closeDialog();
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    }
  }, [confirmDialog, addChildren, removeChildren, resumeSubscription, closeDialog, refetch]);

  const isActionLoading = isAddingChildren || isRemovingChildren || isResuming;

  // Loading
  if (isLoading || isLoadingChildren) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  // No subscription
  if (!isPremium && !isCanceled) {
    return (
      <PageContainer className="max-w-2xl">
        <Button variant="ghost" size="sm" onClick={handleGoBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>

        <Card className="text-center py-12">
          <CardContent className="space-y-6">
            <Crown className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Pas d'abonnement actif</h2>
              <p className="text-muted-foreground">
                Passez à Premium pour débloquer toutes les fonctionnalités.
              </p>
            </div>
            <Button size="lg" onClick={handleGoToPricing}>
              Découvrir Premium
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={handleGoBack} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour
      </Button>

      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Mon abonnement</h1>
        <Badge variant={isCanceled ? 'secondary' : 'default'}>
          <Crown className="h-3 w-3 mr-1" />
          Premium
        </Badge>
      </div>

      {/* Subscription Info Card */}
      <Card className={cn('mb-6', isCanceled && 'border-amber-500/50')}>
        <CardContent className="pt-6">
          {/* Status alert if canceled */}
          {isCanceled && (
            <div className="bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-lg p-4 mb-4">
              <p className="font-medium mb-1">Abonnement annulé</p>
              <p className="text-sm">
                Vos enfants gardent l'accès Premium jusqu'au <strong>{formatPeriodEnd(currentPeriodEnd)}</strong>.
                Après cette date, ils passeront au plan Gratuit.
              </p>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-muted-foreground">Enfants Premium</p>
              <p className="text-lg font-semibold">{premiumChildrenCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tarification</p>
              <p className="text-lg font-semibold">15€ + 5€/enfant suppl.</p>
            </div>
            {!isCanceled && (
              <div>
                <p className="text-muted-foreground">Prochain renouvellement</p>
                <p className="font-medium">{formatPeriodEnd(currentPeriodEnd)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenPortal} disabled={isOpeningPortal}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Facturation
            </Button>
            {isCanceled && (
              <Button size="sm" onClick={() => setConfirmDialog({ type: 'resume' })}>
                Réactiver l'abonnement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Children List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mes enfants</CardTitle>
        </CardHeader>
        <CardContent>
          {!children?.length ? (
            <p className="text-muted-foreground text-sm">Aucun enfant</p>
          ) : (
            <div className="space-y-2">
              {children.map((child: IChild) => {
                const { isPremium: isChildPremium, isPendingRemoval } = getChildStatus(child.id);

                return (
                  <div
                    key={child.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      isChildPremium ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isChildPremium && <Crown className="h-4 w-4 text-amber-500" />}
                      <span className="font-medium">{child.firstName}</span>
                      {child.schoolLevel && (
                        <span className="text-xs text-muted-foreground">({child.schoolLevel})</span>
                      )}
                      {isPendingRemoval && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          Fin prévue
                        </Badge>
                      )}
                    </div>

                    {/* Action button - only if not canceled */}
                    {!isCanceled && (
                      isChildPremium ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDialog({ type: 'remove', child })}
                          disabled={isPendingRemoval}
                        >
                          <Minus className="h-4 w-4 mr-1" />
                          Retirer
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDialog({ type: 'add', child })}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Premium
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.type !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'add' && `Ajouter ${confirmDialog.child?.firstName} ?`}
              {confirmDialog.type === 'remove' && `Retirer ${confirmDialog.child?.firstName} ?`}
              {confirmDialog.type === 'resume' && "Réactiver l'abonnement ?"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'add' && (
                <>
                  {isLoadingProrata ? (
                    'Calcul du montant...'
                  ) : prorataPreview ? (
                    <>
                      Vous serez facturé <strong>{prorataPreview.prorata.amount}</strong> maintenant
                      ({prorataPreview.prorata.daysRemaining}j restants).
                      Puis <strong>{formatPriceEuros(newPriceAfterAction ?? 0)}/mois</strong>.
                    </>
                  ) : (
                    `Nouveau tarif : ${formatPriceEuros(newPriceAfterAction ?? 0)}/mois`
                  )}
                </>
              )}
              {confirmDialog.type === 'remove' && (
                <>
                  {confirmDialog.child?.firstName} gardera l'accès Premium jusqu'au{' '}
                  <strong>{formatPeriodEnd(currentPeriodEnd)}</strong>.
                  Nouveau tarif : <strong>{formatPriceEuros(newPriceAfterAction ?? 0)}/mois</strong>.
                </>
              )}
              {confirmDialog.type === 'resume' && (
                <>Votre abonnement reprendra normalement.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog}>
              Annuler
            </Button>
            <Button
              variant={confirmDialog.type === 'remove' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={isActionLoading || (confirmDialog.type === 'add' && isLoadingProrata)}
            >
              {isActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirmer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
