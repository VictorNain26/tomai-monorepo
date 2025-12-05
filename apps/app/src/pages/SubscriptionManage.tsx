/**
 * SubscriptionManage - Full subscription management page
 *
 * Allows parents to:
 * - View current subscription status
 * - Add/remove children from premium
 * - Cancel/resume subscription
 * - Open Stripe customer portal
 */

import { type ReactElement, useState, useMemo, useEffect } from 'react';
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
  Info,
  Loader2,
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
  previewAddChildren,
  type IAddChildrenPreview,
} from '@/lib/subscription';
import { useUser } from '@/lib/auth';
import type { IChild } from '@/types';

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

  // Prorata preview state
  const [prorataPreview, setProrataPreview] = useState<IAddChildrenPreview | null>(null);
  const [isLoadingProrata, setIsLoadingProrata] = useState(false);
  const [prorataError, setProrataError] = useState<string | null>(null);

  // Fetch prorata when selection changes
  useEffect(() => {
    const fetchProrata = async () => {
      if (!showAddDialog || selectedForAdd.length === 0 || !user?.id) {
        setProrataPreview(null);
        return;
      }

      setIsLoadingProrata(true);
      setProrataError(null);

      try {
        const preview = await previewAddChildren(user.id, selectedForAdd.length);
        setProrataPreview(preview);
      } catch (error) {
        setProrataError(error instanceof Error ? error.message : 'Erreur de calcul');
        setProrataPreview(null);
      } finally {
        setIsLoadingProrata(false);
      }
    };

    void fetchProrata();
  }, [showAddDialog, selectedForAdd.length, user?.id]);

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

      {/* Billing Info Section */}
      {isPremium && !isCanceled && (
        <Card className="mt-6 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              Comment fonctionne la facturation ?
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Ajout d'enfant</p>
                <p className="text-xs text-muted-foreground">
                  Le montant est facturé au prorata immédiatement pour les jours
                  restants. Vous verrez le montant exact avant confirmation.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Retrait d'enfant</p>
                <p className="text-xs text-muted-foreground">
                  Pas de remboursement. L'enfant garde l'accès Premium jusqu'à la fin
                  de la période payée, puis le nouveau tarif s'applique.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Annulation</p>
                <p className="text-xs text-muted-foreground">
                  Tous les enfants conservent l'accès Premium jusqu'à la fin de la
                  période payée. Vous pouvez réactiver à tout moment.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Tarification</p>
                <p className="text-xs text-muted-foreground">
                  Premier enfant : 15€/mois. Chaque enfant supplémentaire : +5€/mois.
                  Exemple : 3 enfants = 25€/mois.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Children Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter des enfants à Premium</DialogTitle>
            <DialogDescription>
              Sélectionnez les enfants à passer en Premium.
            </DialogDescription>
          </DialogHeader>

          {/* Info banner about immediate billing */}
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
              <strong>Facturation immédiate :</strong> Un montant au prorata sera
              débité maintenant pour les jours restants de la période en cours.
            </AlertDescription>
          </Alert>

          <div className="space-y-3 py-2">
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

          {/* Prorata calculation result */}
          {selectedForAdd.length > 0 && (
            <div className="space-y-3">
              {isLoadingProrata ? (
                <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Calcul du montant...</span>
                </div>
              ) : prorataError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{prorataError}</AlertDescription>
                </Alert>
              ) : prorataPreview ? (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                  {/* Immediate charge */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">Débit immédiat</p>
                      <p className="text-xs text-muted-foreground">
                        Prorata pour {prorataPreview.prorata.daysRemaining} jours restants
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      {prorataPreview.prorata.amount}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    {/* New monthly */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Nouveau montant mensuel</span>
                      <span className="font-medium">
                        {prorataPreview.newSubscription.monthlyAmount}/mois
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      À partir du {formatPeriodEnd(prorataPreview.prorata.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center text-sm">
                    <span>Nouveau montant mensuel:</span>
                    <span className="font-bold text-lg">
                      {formatPriceEuros(addPrice.new)}/mois
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddChildren}
              disabled={selectedForAdd.length === 0 || isAddingChildren || isLoadingProrata}
            >
              {isAddingChildren ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ajout en cours...
                </>
              ) : prorataPreview ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payer {prorataPreview.prorata.amount} maintenant
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retirer des enfants de Premium</DialogTitle>
            <DialogDescription>
              Sélectionnez les enfants à retirer de l'abonnement Premium.
            </DialogDescription>
          </DialogHeader>

          {/* Important info about removal policy */}
          <div className="space-y-3">
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400 text-sm">
                <strong>Accès maintenu :</strong> Les enfants retirés conservent
                l'accès Premium jusqu'à la fin de la période payée
                {status?.subscription?.currentPeriodEnd && (
                  <> (le {formatPeriodEnd(status.subscription.currentPeriodEnd)})</>
                )}.
              </AlertDescription>
            </Alert>

            <Alert className="border-amber-500/50 bg-amber-500/10">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                <strong>Pas de remboursement :</strong> Le retrait prend effet à la
                prochaine échéance. Aucun remboursement n'est effectué pour la période
                en cours.
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-3 py-2">
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
            <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Nouveau montant mensuel</span>
                <span className="font-bold text-lg">
                  {removePrice.new > 0 ? formatPriceEuros(removePrice.new) : '0€'}/mois
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                À partir du {status?.subscription?.currentPeriodEnd
                  ? formatPeriodEnd(status.subscription.currentPeriodEnd)
                  : 'prochain renouvellement'}
              </p>

              {selectedForRemove.length === premiumChildrenCount && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Attention :</strong> Retirer tous les enfants annulera
                    votre abonnement à la fin de la période.
                  </AlertDescription>
                </Alert>
              )}
            </div>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrait en cours...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Confirmer le retrait ({selectedForRemove.length})
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
                <li>• Quota IA 10x plus élevé par enfant</li>
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
