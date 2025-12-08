/**
 * SubscriptionManage - Full subscription management page
 *
 * Allows parents to:
 * - View current subscription status
 * - Manage children premium access (unified workflow)
 * - Cancel/resume subscription
 * - Open Stripe customer portal
 *
 * All subscription data comes from Stripe (source of truth).
 */

import { type ReactElement, useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Crown,
  Users,
  Settings,
  ExternalLink,
  AlertTriangle,
  Check,
  CreditCard,
  Clock,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  cancelPendingRemoval,
  type IAddChildrenPreview,
} from '@/lib/subscription';
import { useUser } from '@/lib/auth';
import type { IChild } from '@/types';

// ============================================
// Types
// ============================================

type SubscriptionState = 'active' | 'canceled' | 'pending_changes' | 'past_due';

interface StatusBannerProps {
  state: SubscriptionState;
  periodEnd: string | null;
  scheduledChildrenCount?: number | undefined;
  scheduledAmount?: number | undefined;
}

// ============================================
// Status Banner Configuration (static)
// ============================================

const STATUS_BANNER_CONFIG: Record<Exclude<SubscriptionState, 'active'>, { bg: string; title: string }> = {
  canceled: {
    bg: 'bg-destructive/10 border-destructive/30',
    title: 'Abonnement annulé',
  },
  pending_changes: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    title: 'Modifications programmées',
  },
  past_due: {
    bg: 'bg-destructive/10 border-destructive/30',
    title: 'Paiement en attente',
  },
};

// ============================================
// Status Banner Component
// ============================================

function StatusBanner({
  state,
  periodEnd,
  scheduledChildrenCount,
  scheduledAmount,
}: StatusBannerProps): ReactElement | null {
  // Get icon based on state (before early return to respect hooks rules)
  const icon = useMemo(() => {
    switch (state) {
      case 'canceled':
        return <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />;
      case 'pending_changes':
        return <Clock className="h-5 w-5 text-amber-500 shrink-0" />;
      case 'past_due':
        return <CreditCard className="h-5 w-5 text-destructive shrink-0" />;
      default:
        return null;
    }
  }, [state]);

  // Get description based on state
  const description = useMemo(() => {
    switch (state) {
      case 'canceled':
        return `Accès Premium jusqu'au ${formatPeriodEnd(periodEnd)}`;
      case 'pending_changes': {
        let text = `Effectif le ${formatPeriodEnd(periodEnd)}`;
        if (scheduledChildrenCount !== undefined) {
          text += ` • ${scheduledChildrenCount} enfant(s)`;
        }
        if (scheduledAmount !== undefined) {
          text += ` • ${formatPriceEuros(scheduledAmount / 100)}/mois`;
        }
        return text;
      }
      case 'past_due':
        return 'Mettez à jour votre moyen de paiement dans le portail de facturation';
      default:
        return '';
    }
  }, [state, periodEnd, scheduledChildrenCount, scheduledAmount]);

  // Early return after all hooks
  if (state === 'active') return null;

  const config = STATUS_BANNER_CONFIG[state];

  return (
    <div className={cn('rounded-lg border p-4 mb-6', config.bg)}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{config.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Billing Info Sheet Component
// ============================================

function BillingInfoSheet(): ReactElement {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Informations de facturation"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Comment fonctionne la facturation ?</SheetTitle>
          <SheetDescription>
            Tout ce que vous devez savoir sur la gestion de votre abonnement
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <p className="font-medium">Ajout d'enfant</p>
            </div>
            <p className="text-sm text-muted-foreground pl-4">
              Un montant au prorata est facturé immédiatement pour les jours
              restants de la période en cours. Vous verrez le montant exact
              avant de confirmer.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              <p className="font-medium">Retrait d'enfant</p>
            </div>
            <p className="text-sm text-muted-foreground pl-4">
              Pas de remboursement. L'enfant garde l'accès Premium jusqu'à la
              fin de la période payée, puis le nouveau tarif s'applique.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
              <p className="font-medium">Annulation</p>
            </div>
            <p className="text-sm text-muted-foreground pl-4">
              Tous les enfants conservent l'accès Premium jusqu'à la fin de la
              période payée. Vous pouvez réactiver à tout moment.
            </p>
          </div>

          <div className="border-t pt-6">
            <p className="font-medium mb-3">Tarification</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-muted-foreground">1er enfant</p>
                <p className="text-xl font-bold">
                  15€<span className="text-sm font-normal">/mois</span>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-muted-foreground">Enfant suppl.</p>
                <p className="text-xl font-bold">
                  +5€<span className="text-sm font-normal">/mois</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Exemple : 3 enfants = 15€ + 5€ + 5€ = 25€/mois
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Child List Item Component
// ============================================

interface ChildListItemProps {
  child: IChild;
  isPremium: boolean;
  isPendingRemoval: boolean;
}

function ChildListItem({ child, isPremium, isPendingRemoval }: ChildListItemProps): ReactElement {
  return (
    <li
      className={cn(
        'flex items-center justify-between p-2.5 rounded-lg',
        isPremium ? 'bg-primary/5' : 'bg-muted/30'
      )}
    >
      <div className="flex items-center gap-2">
        {isPremium && <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />}
        <span className="font-medium">{child.firstName}</span>
        {child.schoolLevel && (
          <span className="text-xs text-muted-foreground">({child.schoolLevel})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isPendingRemoval && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            Fin prévue
          </Badge>
        )}
        <Badge variant={isPremium ? 'default' : 'outline'} className="text-xs">
          {isPremium ? 'Premium' : 'Gratuit'}
        </Badge>
      </div>
    </li>
  );
}

// ============================================
// Child Management Item Component (unified workflow)
// ============================================

interface ChildManagementItemProps {
  child: IChild;
  currentlyPremium: boolean;
  targetPremium: boolean;
  isPendingRemoval: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ChildManagementItem({
  child,
  currentlyPremium,
  targetPremium,
  isPendingRemoval,
  onToggle,
  disabled,
}: ChildManagementItemProps): ReactElement {
  const hasChange = currentlyPremium !== targetPremium;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        hasChange && targetPremium && 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20',
        hasChange && !targetPremium && 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20',
        !hasChange && 'border-border'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
            targetPremium ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
          )}
        >
          {targetPremium ? (
            <Crown className="h-4 w-4" aria-hidden="true" />
          ) : (
            child.firstName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{child.firstName}</span>
            {isPendingRemoval && !hasChange && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                Fin prévue
              </Badge>
            )}
          </div>
          {child.schoolLevel && (
            <span className="text-xs text-muted-foreground">{child.schoolLevel}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {hasChange && (
          <span className="text-xs text-muted-foreground">
            {targetPremium ? '→ Premium' : '→ Gratuit'}
          </span>
        )}
        <Button
          variant={targetPremium ? 'default' : 'outline'}
          size="sm"
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            'min-w-[90px]',
            targetPremium && 'bg-amber-500 hover:bg-amber-600 text-white'
          )}
        >
          {targetPremium ? 'Premium' : 'Gratuit'}
        </Button>
      </div>
    </div>
  );
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
    cancelSubscription,
    isCanceling,
    resumeSubscription,
    isResuming,
    refetch,
  } = useSubscription();
  const { children, isLoading: isLoadingChildren } = useParentDataQuery();

  // Dialog states
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Unified children management state: map of childId -> targetPremium status
  const [targetPremiumMap, setTargetPremiumMap] = useState<Record<string, boolean>>({});

  // Prorata preview state
  const [prorataPreview, setProrataPreview] = useState<IAddChildrenPreview | null>(null);
  const [isLoadingProrata, setIsLoadingProrata] = useState(false);
  const [prorataError, setProrataError] = useState<string | null>(null);

  // Reactivation state
  const [isReactivating, setIsReactivating] = useState(false);

  // Derived state from Stripe (source of truth)
  const isPremium = status ? isPremiumActive(status) : false;
  const isCanceled = status ? isCanceledButActive(status) : false;
  const hasPending = status ? hasPendingChanges(status) : false;
  const premiumChildrenCount = status?.billing?.premiumChildrenCount ?? 0;

  // Subscription state for banner
  const subscriptionState: SubscriptionState = useMemo(() => {
    if (status?.status === 'past_due') return 'past_due';
    if (isCanceled) return 'canceled';
    if (hasPending) return 'pending_changes';
    return 'active';
  }, [status?.status, isCanceled, hasPending]);

  // Children categorized by plan (from Stripe data)
  const { freeChildren, allChildren } = useMemo(() => {
    if (!children || !status?.children) {
      return { freeChildren: children ?? [], allChildren: children ?? [] };
    }

    const premiumIds = new Set(
      status.children.filter((c) => c.plan === 'premium').map((c) => c.id)
    );

    return {
      freeChildren: children.filter((c: IChild) => !premiumIds.has(c.id)),
      allChildren: children,
    };
  }, [children, status?.children]);

  // Calculate changes from targetPremiumMap
  const pendingChanges = useMemo(() => {
    if (!children || !status?.children) {
      return { toAdd: [], toRemove: [], hasChanges: false };
    }

    const currentPremiumIds = new Set(
      status.children.filter((c) => c.plan === 'premium').map((c) => c.id)
    );

    const toAdd: string[] = [];
    const toRemove: string[] = [];

    for (const [childId, targetPremium] of Object.entries(targetPremiumMap)) {
      const currentlyPremium = currentPremiumIds.has(childId);
      if (targetPremium && !currentlyPremium) {
        toAdd.push(childId);
      } else if (!targetPremium && currentlyPremium) {
        toRemove.push(childId);
      }
    }

    return {
      toAdd,
      toRemove,
      hasChanges: toAdd.length > 0 || toRemove.length > 0,
    };
  }, [children, status?.children, targetPremiumMap]);

  // Calculate new price after changes
  const newPriceInfo = useMemo(() => {
    const currentCount = premiumChildrenCount;
    const newCount = currentCount + pendingChanges.toAdd.length - pendingChanges.toRemove.length;
    const newPrice = PRICING_INFO.calculateTotal(Math.max(0, newCount));
    return { newCount: Math.max(0, newCount), newPrice };
  }, [premiumChildrenCount, pendingChanges]);

  // Card border color based on state
  const cardBorderClass = useMemo(() => {
    switch (subscriptionState) {
      case 'canceled':
      case 'past_due':
        return 'border-destructive/50';
      case 'pending_changes':
        return 'border-amber-500/50';
      default:
        return 'border-green-500/50';
    }
  }, [subscriptionState]);

  // Fetch prorata preview when adding children (unified workflow)
  useEffect(() => {
    if (!showManageDialog || pendingChanges.toAdd.length === 0 || !user?.id) {
      setProrataPreview(null);
      setProrataError(null);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchProrata = async () => {
      setIsLoadingProrata(true);
      setProrataError(null);

      try {
        const preview = await previewAddChildren(user.id, pendingChanges.toAdd.length);
        if (!isCancelled) {
          setProrataPreview(preview);
        }
      } catch (error) {
        if (!isCancelled) {
          setProrataError(error instanceof Error ? error.message : 'Erreur de calcul');
          setProrataPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProrata(false);
        }
      }
    };

    void fetchProrata();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [showManageDialog, pendingChanges.toAdd.length, user?.id]);

  // Handlers with useCallback for stable references
  const handleGoBack = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  const handleGoToPricing = useCallback(() => {
    void navigate('/subscription/pricing');
  }, [navigate]);

  // Unified handler for applying all changes (add + remove)
  const handleApplyChanges = useCallback(async () => {
    if (!pendingChanges.hasChanges) return;

    try {
      // First, add children if any
      if (pendingChanges.toAdd.length > 0) {
        await addChildren(pendingChanges.toAdd);
      }

      // Then, remove children if any
      if (pendingChanges.toRemove.length > 0) {
        await removeChildren(pendingChanges.toRemove);
      }

      // Success message based on changes
      const messages: string[] = [];
      if (pendingChanges.toAdd.length > 0) {
        messages.push(`${pendingChanges.toAdd.length} enfant(s) ajouté(s)`);
      }
      if (pendingChanges.toRemove.length > 0) {
        messages.push(`${pendingChanges.toRemove.length} enfant(s) retiré(s)`);
      }
      toast.success(messages.join(' et '));

      setShowManageDialog(false);
      setTargetPremiumMap({});
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la modification');
    }
  }, [pendingChanges, addChildren, removeChildren, refetch]);

  const handleCancelSubscription = useCallback(async () => {
    try {
      await cancelSubscription();
      toast.success("Abonnement annulé. L'accès reste actif jusqu'à la fin de la période.");
      setShowCancelDialog(false);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'annulation");
    }
  }, [cancelSubscription, refetch]);

  const handleResumeSubscription = useCallback(async () => {
    try {
      await resumeSubscription();
      toast.success('Abonnement réactivé avec succès');
      setShowManageDialog(false);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la réactivation');
    }
  }, [resumeSubscription, refetch]);

  const handleOpenPortal = useCallback(async () => {
    try {
      await openPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'ouverture du portail");
    }
  }, [openPortal]);

  const handleCancelPendingRemoval = useCallback(async () => {
    if (!user?.id) return;

    setIsReactivating(true);
    try {
      await cancelPendingRemoval(user.id);
      toast.success('Modifications annulées - tous les enfants restent Premium');
      setShowManageDialog(false);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la réactivation');
    } finally {
      setIsReactivating(false);
    }
  }, [user?.id, refetch]);

  // Open manage dialog with current state initialized
  const handleOpenManageDialog = useCallback(() => {
    // Initialize targetPremiumMap with current state from Stripe
    const initialMap: Record<string, boolean> = {};
    if (children && status?.children) {
      const premiumIds = new Set(
        status.children.filter((c) => c.plan === 'premium').map((c) => c.id)
      );
      for (const child of children) {
        initialMap[child.id] = premiumIds.has(child.id);
      }
    }
    setTargetPremiumMap(initialMap);
    setShowManageDialog(true);
  }, [children, status?.children]);

  const handleCloseManageDialog = useCallback(() => {
    setShowManageDialog(false);
    setTargetPremiumMap({});
  }, []);

  const handleCloseCancelDialog = useCallback(() => {
    setShowCancelDialog(false);
  }, []);

  const handleOpenCancelDialog = useCallback(() => {
    setShowCancelDialog(true);
  }, []);

  // Toggle a child's target premium status
  const handleToggleChildPremium = useCallback((childId: string) => {
    setTargetPremiumMap((prev) => ({
      ...prev,
      [childId]: !prev[childId],
    }));
  }, []);

  // Loading state
  if (isLoading || isLoadingChildren) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  // No subscription (free plan) - show upgrade prompt
  if (!isPremium && !isCanceled) {
    return (
      <PageContainer className="max-w-3xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        <Card className="text-center py-12">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Crown className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Pas d'abonnement actif</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Passez à TomIA Premium pour débloquer toutes les fonctionnalités
                et offrir le meilleur accompagnement à vos enfants.
              </p>
            </div>
            <Button size="lg" onClick={handleGoToPricing}>
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
          onClick={handleGoBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Mon abonnement</h1>
            <Badge
              variant={subscriptionState === 'active' ? 'default' : 'secondary'}
              className="text-sm"
            >
              <Crown className="h-3 w-3 mr-1" aria-hidden="true" />
              Premium
            </Badge>
          </div>
          <BillingInfoSheet />
        </div>
      </div>

      {/* Status Banner (informational only) */}
      <StatusBanner
        state={subscriptionState}
        periodEnd={status?.subscription?.currentPeriodEnd ?? null}
        scheduledChildrenCount={status?.subscription?.scheduledChildrenCount}
        scheduledAmount={status?.subscription?.scheduledMonthlyAmountCents}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Subscription Card */}
        <Card className={cardBorderClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
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
                {status?.billing?.monthlyAmount ??
                  formatPriceEuros(PRICING_INFO.calculateTotal(premiumChildrenCount))}
              </span>
            </div>
            {status?.subscription?.currentPeriodEnd && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {isCanceled ? "Fin d'accès" : 'Renouvellement'}
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
              <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
              {isOpeningPortal ? 'Ouverture...' : 'Portail de facturation'}
            </Button>
            {!isCanceled && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleOpenCancelDialog}
              >
                Annuler l'abonnement
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Unified Children Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" aria-hidden="true" />
                Mes enfants
              </CardTitle>
              <div className="flex gap-1">
                <Badge variant="default" className="text-xs">
                  {premiumChildrenCount} Premium
                </Badge>
                {freeChildren.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {freeChildren.length} Gratuit
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription>Gérez l'accès Premium de vos enfants</CardDescription>
          </CardHeader>
          <CardContent>
            {allChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun enfant</p>
            ) : (
              <ul className="space-y-2">
                {allChildren.map((child: IChild) => {
                  const childStatus = status?.children?.find((c) => c.id === child.id);
                  const isChildPremium = childStatus?.plan === 'premium';
                  const isPendingRemoval = childStatus?.status === 'pending_removal';

                  return (
                    <ChildListItem
                      key={child.id}
                      child={child}
                      isPremium={isChildPremium}
                      isPendingRemoval={isPendingRemoval}
                    />
                  );
                })}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            {allChildren.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenManageDialog}
              >
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                Gérer l'abonnement
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Unified Children Management Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gérer l'abonnement</DialogTitle>
            <DialogDescription>
              {isCanceled
                ? "Votre abonnement est annulé. Réactivez-le ou modifiez l'accès Premium de vos enfants."
                : hasPending
                  ? 'Des modifications sont programmées. Vous pouvez les annuler ou en faire de nouvelles.'
                  : "Cliquez sur un enfant pour modifier son accès. Les changements s'appliquent en un clic."}
            </DialogDescription>
          </DialogHeader>

          {/* Action buttons for canceled or pending states */}
          {(isCanceled || hasPending) && (
            <div className="space-y-2">
              {isCanceled && (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleResumeSubscription}
                  disabled={isResuming}
                >
                  {isResuming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      Réactivation...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                      Réactiver l'abonnement
                    </>
                  )}
                </Button>
              )}
              {hasPending && !isCanceled && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCancelPendingRemoval}
                  disabled={isReactivating}
                >
                  {isReactivating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      Annulation...
                    </>
                  ) : (
                    'Annuler les modifications programmées'
                  )}
                </Button>
              )}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou modifier</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 py-2">
            {allChildren.map((child: IChild) => {
              const childStatus = status?.children?.find((c) => c.id === child.id);
              const currentlyPremium = childStatus?.plan === 'premium';
              const targetPremium = targetPremiumMap[child.id] ?? currentlyPremium;
              const isPendingRemoval = childStatus?.status === 'pending_removal';

              return (
                <ChildManagementItem
                  key={child.id}
                  child={child}
                  currentlyPremium={currentlyPremium}
                  targetPremium={targetPremium}
                  isPendingRemoval={isPendingRemoval}
                  onToggle={() => handleToggleChildPremium(child.id)}
                  disabled={isAddingChildren || isRemovingChildren || isCanceled}
                />
              );
            })}
          </div>

          {/* Changes Summary */}
          {pendingChanges.hasChanges && (
            <div className="space-y-4 pt-2">
              {/* Prorata info for additions */}
              {pendingChanges.toAdd.length > 0 && (
                <div className="space-y-2">
                  {isLoadingProrata ? (
                    <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span className="text-sm text-muted-foreground">Calcul du prorata...</span>
                    </div>
                  ) : prorataError ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{prorataError}</AlertDescription>
                    </Alert>
                  ) : prorataPreview ? (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            +{pendingChanges.toAdd.length} enfant(s) Premium
                          </p>
                          <p className="text-xs text-green-600/80 dark:text-green-400/80">
                            Facturé maintenant ({prorataPreview.prorata.daysRemaining}j restants)
                          </p>
                        </div>
                        <span className="text-lg font-bold text-green-700 dark:text-green-300">
                          {prorataPreview.prorata.amount}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Removal info */}
              {pendingChanges.toRemove.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        -{pendingChanges.toRemove.length} enfant(s) Premium
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        Accès maintenu jusqu'au {formatPeriodEnd(status?.subscription?.currentPeriodEnd ?? null)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* New monthly price */}
              <div className="p-3 rounded-lg bg-muted border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Nouveau tarif mensuel</span>
                  <span className="text-xl font-bold">
                    {newPriceInfo.newPrice > 0
                      ? formatPriceEuros(newPriceInfo.newPrice)
                      : '0€'}
                    <span className="text-sm font-normal text-muted-foreground">/mois</span>
                  </span>
                </div>
                {newPriceInfo.newCount === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Retirer tous les enfants annulera l'abonnement
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseManageDialog}>
              Annuler
            </Button>
            <Button
              onClick={handleApplyChanges}
              disabled={!pendingChanges.hasChanges || isAddingChildren || isRemovingChildren || isLoadingProrata}
            >
              {isAddingChildren || isRemovingChildren ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  En cours...
                </>
              ) : pendingChanges.toAdd.length > 0 && prorataPreview ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                  Confirmer ({prorataPreview.prorata.amount})
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  Appliquer les modifications
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
              Vos enfants garderont l'accès Premium jusqu'au{' '}
              <strong>
                {status?.subscription?.currentPeriodEnd
                  ? formatPeriodEnd(status.subscription.currentPeriodEnd)
                  : 'la fin de la période'}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Vous perdrez :</p>
              <ul className="space-y-1 ml-4">
                <li>• Quota IA 10x plus élevé par enfant</li>
                <li>• Support prioritaire</li>
                <li>• Fonctionnalités Premium futures</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCancelDialog}>
              Garder Premium
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={isCanceling}>
              {isCanceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Annulation...
                </>
              ) : (
                "Confirmer l'annulation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
