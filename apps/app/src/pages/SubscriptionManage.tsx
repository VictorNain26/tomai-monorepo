/**
 * SubscriptionManage - Full subscription management page
 *
 * Allows parents to:
 * - View current subscription status
 * - Add/remove children from premium
 * - Cancel/resume subscription
 * - Open Stripe customer portal
 */

import { type ReactElement, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Crown,
  Users,
  Plus,
  Minus,
  ExternalLink,
  AlertTriangle,
  Check,
  X,
  CreditCard,
  Calendar,
  Clock,
} from 'lucide-react';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  hasPendingChanges,
} from '@/lib/subscription';
import type { IChild } from '@/types';

export default function SubscriptionManage(): ReactElement {
  const navigate = useNavigate();
  const {
    status,
    isLoading,
    addChildren,
    isAddingChildren,
    removeChildren,
    isRemovingChildren,
    openPortal,
    isOpeningPortal,
    cancelSubscription,
    isCanceling,
    resumeSubscription,
    isResuming,
    refetch,
  } = useSubscription();
  const { children, isLoading: isLoadingChildren } = useParentDataQuery();

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Selected children for add/remove
  const [selectedForAdd, setSelectedForAdd] = useState<string[]>([]);
  const [selectedForRemove, setSelectedForRemove] = useState<string[]>([]);

  // Derived state
  const isPremium = status ? isPremiumActive(status) : false;
  const isCanceled = status ? isCanceledButActive(status) : false;
  const hasPending = status ? hasPendingChanges(status) : false;
  const premiumChildrenCount = status?.billing?.premiumChildrenCount ?? 0;

  // Children categorized by plan
  const { premiumChildren, freeChildren } = useMemo(() => {
    if (!children || !status?.children) {
      return { premiumChildren: [], freeChildren: children ?? [] };
    }

    const premiumIds = new Set(
      status.children.filter((c) => c.plan === 'premium').map((c) => c.id)
    );

    return {
      premiumChildren: children.filter((c: IChild) => premiumIds.has(c.id)),
      freeChildren: children.filter((c: IChild) => !premiumIds.has(c.id)),
    };
  }, [children, status?.children]);

  // Calculate price changes
  const addPrice = useMemo(() => {
    const currentCount = premiumChildrenCount;
    const newCount = currentCount + selectedForAdd.length;
    const currentPrice = PRICING_INFO.calculateTotal(currentCount);
    const newPrice = PRICING_INFO.calculateTotal(newCount);
    return { current: currentPrice, new: newPrice, diff: newPrice - currentPrice };
  }, [premiumChildrenCount, selectedForAdd.length]);

  const removePrice = useMemo(() => {
    const currentCount = premiumChildrenCount;
    const newCount = Math.max(0, currentCount - selectedForRemove.length);
    const currentPrice = PRICING_INFO.calculateTotal(currentCount);
    const newPrice = PRICING_INFO.calculateTotal(newCount);
    return { current: currentPrice, new: newPrice, diff: currentPrice - newPrice };
  }, [premiumChildrenCount, selectedForRemove.length]);

  // Handlers
  const handleAddChildren = async () => {
    if (selectedForAdd.length === 0) return;

    try {
      await addChildren(selectedForAdd);
      toast.success(
        `${selectedForAdd.length} enfant(s) ajouté(s) à l'abonnement Premium`
      );
      setShowAddDialog(false);
      setSelectedForAdd([]);
      void refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'ajout"
      );
    }
  };

  const handleRemoveChildren = async () => {
    if (selectedForRemove.length === 0) return;

    try {
      await removeChildren(selectedForRemove);
      toast.success(
        `${selectedForRemove.length} enfant(s) sera(ont) retiré(s) à la fin de la période`
      );
      setShowRemoveDialog(false);
      setSelectedForRemove([]);
      void refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erreur lors du retrait'
      );
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription();
      toast.success("Abonnement annulé. L'accès reste actif jusqu'à la fin de la période.");
      setShowCancelDialog(false);
      void refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'annulation"
      );
    }
  };

  const handleResumeSubscription = async () => {
    try {
      await resumeSubscription();
      toast.success('Abonnement réactivé avec succès');
      void refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erreur lors de la réactivation'
      );
    }
  };

  const handleOpenPortal = async () => {
    try {
      await openPortal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erreur lors de l\'ouverture du portail'
      );
    }
  };

  // Loading state
  if (isLoading || isLoadingChildren) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  // No subscription (free plan) - redirect to pricing
  if (!isPremium && !isCanceled) {
    return (
      <PageContainer className="max-w-3xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        <Card className="text-center py-12">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Crown className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Pas d'abonnement actif</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Passez à TomIA Premium pour débloquer toutes les fonctionnalités
                et offrir le meilleur accompagnement à vos enfants.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => void navigate('/subscription/pricing')}
            >
              <Crown className="h-5 w-5 mr-2" />
              Découvrir Premium
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-4xl">
      {/* Back Button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">Gérer mon abonnement</h1>
          <Badge
            variant={isPremium ? 'default' : 'secondary'}
            className="text-sm"
          >
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Gérez vos enfants, votre facturation et vos préférences d'abonnement.
        </p>
      </div>

      {/* Alerts */}
      {isCanceled && status?.subscription && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Abonnement annulé</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Votre abonnement prendra fin le{' '}
              <strong>{formatPeriodEnd(status.subscription.currentPeriodEnd)}</strong>.
              Vos enfants garderont l'accès Premium jusqu'à cette date.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResumeSubscription}
              disabled={isResuming}
              className="w-fit"
            >
              {isResuming ? 'Réactivation...' : 'Réactiver l\'abonnement'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {hasPending && status?.subscription && !isCanceled && (
        <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
          <Clock className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            Modifications programmées
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Des changements prendront effet le{' '}
            <strong>{formatPeriodEnd(status.subscription.currentPeriodEnd)}</strong>.
            {status.subscription.scheduledChildrenCount !== undefined && (
              <span>
                {' '}Nouveau total: {status.subscription.scheduledChildrenCount} enfant(s) Premium
                {status.subscription.scheduledMonthlyAmountCents && (
                  <> ({formatPriceEuros(status.subscription.scheduledMonthlyAmountCents / 100)}/mois)</>
                )}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {status?.status === 'past_due' && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Paiement en attente</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Le dernier paiement a échoué. Mettez à jour votre moyen de paiement
              pour éviter l'interruption du service.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPortal}
              disabled={isOpeningPortal}
              className="w-fit"
            >
              Mettre à jour le paiement
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Abonnement actuel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">TomIA Premium</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Enfants Premium</span>
              <span className="font-medium">{premiumChildrenCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Montant mensuel</span>
              <span className="font-medium text-lg">
                {status?.billing?.monthlyAmount ?? formatPriceEuros(PRICING_INFO.calculateTotal(premiumChildrenCount))}
              </span>
            </div>
            {status?.subscription?.currentPeriodEnd && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {isCanceled ? "Fin d'accès" : 'Prochain renouvellement'}
                </span>
                <span className="font-medium">
                  {formatPeriodEnd(status.subscription.currentPeriodEnd)}
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleOpenPortal}
              disabled={isOpeningPortal}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isOpeningPortal ? 'Ouverture...' : 'Portail de facturation'}
            </Button>
            {!isCanceled && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancelDialog(true)}
              >
                Annuler l'abonnement
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Premium Children */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Enfants Premium
              </CardTitle>
              <Badge variant="secondary">{premiumChildrenCount}</Badge>
            </div>
            <CardDescription>
              Gérez quels enfants ont accès à Premium
            </CardDescription>
          </CardHeader>
          <CardContent>
            {premiumChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun enfant Premium actuellement
              </p>
            ) : (
              <ul className="space-y-2">
                {premiumChildren.map((child: IChild) => {
                  const childStatus = status?.children?.find((c) => c.id === child.id);
                  const isPendingRemoval = childStatus?.status === 'pending_removal';

                  return (
                    <li
                      key={child.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">{child.firstName}</span>
                        {child.schoolLevel && (
                          <span className="text-xs text-muted-foreground">
                            ({child.schoolLevel})
                          </span>
                        )}
                      </div>
                      {isPendingRemoval && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          Fin prévue
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            {freeChildren.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setSelectedForAdd([]);
                  setShowAddDialog(true);
                }}
                disabled={isCanceled}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            )}
            {premiumChildren.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setSelectedForRemove([]);
                  setShowRemoveDialog(true);
                }}
                disabled={isCanceled}
              >
                <Minus className="h-4 w-4 mr-1" />
                Retirer
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Free Children Card (if any) */}
      {freeChildren.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Enfants en plan gratuit
            </CardTitle>
            <CardDescription>
              Ces enfants n'ont pas accès aux fonctionnalités Premium
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {freeChildren.map((child: IChild) => (
                <li
                  key={child.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{child.firstName}</span>
                    {child.schoolLevel && (
                      <span className="text-xs text-muted-foreground">
                        ({child.schoolLevel})
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Gratuit
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
          {!isCanceled && (
            <CardFooter>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setSelectedForAdd(freeChildren.map((c: IChild) => c.id));
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter tous à Premium
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {/* Add Children Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter des enfants à Premium</DialogTitle>
            <DialogDescription>
              Sélectionnez les enfants à passer en Premium. Le montant sera
              facturé au prorata immédiatement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {freeChildren.map((child: IChild) => (
              <label
                key={child.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedForAdd.includes(child.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedForAdd((prev) => [...prev, child.id]);
                    } else {
                      setSelectedForAdd((prev) =>
                        prev.filter((id) => id !== child.id)
                      );
                    }
                  }}
                />
                <span className="flex-1 font-medium">{child.firstName}</span>
                {child.schoolLevel && (
                  <span className="text-sm text-muted-foreground">
                    {child.schoolLevel}
                  </span>
                )}
              </label>
            ))}
          </div>

          {selectedForAdd.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex justify-between items-center text-sm">
                <span>Nouveau montant mensuel:</span>
                <span className="font-bold text-lg">
                  {formatPriceEuros(addPrice.new)}/mois
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{formatPriceEuros(addPrice.diff)} (facturé au prorata aujourd'hui)
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddChildren}
              disabled={selectedForAdd.length === 0 || isAddingChildren}
            >
              {isAddingChildren ? (
                <>
                  <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Ajout...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmer ({selectedForAdd.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Children Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer des enfants de Premium</DialogTitle>
            <DialogDescription>
              Les enfants retirés garderont l'accès Premium jusqu'à la fin de la
              période actuelle. Pas de remboursement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {premiumChildren.map((child: IChild) => (
              <label
                key={child.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedForRemove.includes(child.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedForRemove((prev) => [...prev, child.id]);
                    } else {
                      setSelectedForRemove((prev) =>
                        prev.filter((id) => id !== child.id)
                      );
                    }
                  }}
                />
                <span className="flex-1 font-medium">{child.firstName}</span>
                {child.schoolLevel && (
                  <span className="text-sm text-muted-foreground">
                    {child.schoolLevel}
                  </span>
                )}
              </label>
            ))}
          </div>

          {selectedForRemove.length > 0 && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <p>
                  À la fin de la période, votre abonnement passera à{' '}
                  <strong>{formatPriceEuros(removePrice.new)}/mois</strong>.
                </p>
                {selectedForRemove.length === premiumChildrenCount && (
                  <p className="mt-1 font-medium">
                    Retirer tous les enfants annulera l'abonnement.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveChildren}
              disabled={selectedForRemove.length === 0 || isRemovingChildren}
            >
              {isRemovingChildren ? (
                <>
                  <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Retrait...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Retirer ({selectedForRemove.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler l'abonnement ?</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler votre abonnement TomIA Premium ?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Vos enfants garderont l'accès Premium jusqu'au{' '}
                <strong>
                  {status?.subscription?.currentPeriodEnd
                    ? formatPeriodEnd(status.subscription.currentPeriodEnd)
                    : 'la fin de la période'}
                </strong>
                .
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Ce que vous perdrez :</p>
              <ul className="space-y-1 ml-4">
                <li>• 50 000 tokens/jour par enfant (vs 5 000 gratuit)</li>
                <li>• Support prioritaire</li>
                <li>• Accès aux fonctionnalités Premium futures</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Garder Premium
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <>
                  <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Annulation...
                </>
              ) : (
                'Confirmer l\'annulation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
