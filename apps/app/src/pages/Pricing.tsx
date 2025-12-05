/**
 * Pricing Page - Subscription Plans Display
 *
 * Shows per-child pricing model:
 * - First child: 15€/month
 * - Additional children: +5€/month each
 */

import { type ReactElement, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Check, Users } from 'lucide-react';
import { PageContainer } from '@/components/shared/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';
import { useUser } from '@/lib/auth';
import { SUBSCRIPTION_PLANS, PRICING_INFO, formatPriceEuros } from '@/lib/subscription';
import type { IChild } from '@/types';

export default function Pricing(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const { status, checkout, isCheckingOut, isLoading } = useSubscription();
  const { children, isLoading: isLoadingChildren } = useParentDataQuery();

  // Selected children for premium upgrade
  const [selectedChildrenIds, setSelectedChildrenIds] = useState<string[]>([]);

  // Get children with their subscription status from status.children (includes plan info)
  const childrenWithStatus = useMemo(() => status?.children ?? [], [status?.children]);

  // Filter out children who are already premium (memoized)
  const freeChildren = useMemo(() => {
    if (!children) return [];
    return children.filter((child: IChild) => {
      const childStatus = childrenWithStatus.find(c => c.id === child.id);
      return childStatus?.plan !== 'premium';
    });
  }, [children, childrenWithStatus]);

  // Initialize with only free children selected
  useEffect(() => {
    if (freeChildren.length > 0) {
      setSelectedChildrenIds(freeChildren.map((c: IChild) => c.id));
    }
  }, [freeChildren]);

  const isParent = user?.role === 'parent';
  const childrenCount = selectedChildrenIds.length;
  const monthlyPrice = PRICING_INFO.calculateTotal(childrenCount);

  const handleChildToggle = (childId: string, checked: boolean) => {
    if (checked) {
      setSelectedChildrenIds((prev) => [...prev, childId]);
    } else {
      setSelectedChildrenIds((prev) => prev.filter((id) => id !== childId));
    }
  };

  const handleSelectAll = () => {
    // Only select children who are not already premium
    setSelectedChildrenIds(freeChildren.map((c: IChild) => c.id));
  };

  const handleSelectNone = () => {
    setSelectedChildrenIds([]);
  };

  // Count of premium children (already subscribed)
  const premiumChildrenCount = (children?.length ?? 0) - freeChildren.length;

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour continuer');
      void navigate('/auth/login');
      return;
    }

    if (!isParent) {
      toast.error('Seuls les parents peuvent gérer les abonnements');
      return;
    }

    if (selectedChildrenIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un enfant');
      return;
    }

    try {
      await checkout(selectedChildrenIds);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la redirection vers le paiement'
      );
    }
  };

  const handleContinueFree = () => {
    void navigate(-1);
  };

  const freePlan = SUBSCRIPTION_PLANS.FREE;
  const premiumPlan = SUBSCRIPTION_PLANS.PREMIUM;

  return (
    <PageContainer className="max-w-5xl">
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
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Choisissez votre plan
        </h1>
        <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
          Offrez à vos enfants un accompagnement personnalisé avec TomIA Premium.
          Annulez à tout moment.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto mb-12">
        {/* Free Plan */}
        <Card className="flex flex-col">
          <CardHeader className="text-center pt-8 pb-4">
            <CardTitle className="text-xl">{freePlan.name}</CardTitle>
            <div className="mt-4">
              <span className="text-4xl font-bold tracking-tight">Gratuit</span>
            </div>
            <CardDescription className="mt-2">
              {freePlan.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 px-6">
            <ul className="space-y-3">
              {freePlan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="p-6 pt-4">
            <Button
              onClick={handleContinueFree}
              variant="outline"
              size="lg"
              className="w-full"
              disabled={status?.plan === 'free' && !status?.subscription}
            >
              {status?.plan === 'free' ? 'Plan actuel' : 'Continuer gratuitement'}
            </Button>
          </CardFooter>
        </Card>

        {/* Premium Plan with Child Selection */}
        <Card className="flex flex-col border-primary shadow-lg scale-[1.02]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="px-3 py-1 text-xs font-medium">
              Recommandé
            </Badge>
          </div>

          <CardHeader className="text-center pt-8 pb-4">
            <CardTitle className="text-xl">{premiumPlan.name}</CardTitle>
            <div className="mt-4">
              <span className="text-4xl font-bold tracking-tight">
                {childrenCount > 0 ? formatPriceEuros(monthlyPrice) : '15€'}
              </span>
              <span className="text-muted-foreground ml-1">/mois</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <span>1er enfant: 15€</span>
              <span className="mx-1">•</span>
              <span>+5€/enfant supplémentaire</span>
            </div>
            <CardDescription className="mt-2">
              {premiumPlan.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 px-6 space-y-6">
            {/* Features */}
            <ul className="space-y-3">
              {premiumPlan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Child Selection (only for parents with children) */}
            {isParent && children && children.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Sélectionnez les enfants</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs h-7 px-2"
                    >
                      Tous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectNone}
                      className="text-xs h-7 px-2"
                    >
                      Aucun
                    </Button>
                  </div>
                </div>

                {isLoadingChildren || isLoading ? (
                  <div className="text-sm text-muted-foreground">Chargement...</div>
                ) : freeChildren.length === 0 && premiumChildrenCount > 0 ? (
                  <div className="text-sm text-muted-foreground p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Tous vos enfants sont déjà Premium !
                    </p>
                    <p className="text-xs mt-1 text-green-600 dark:text-green-500">
                      Gérez votre abonnement depuis votre espace client.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Free children - selectable */}
                    {freeChildren.map((child: IChild) => (
                      <label
                        key={child.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedChildrenIds.includes(child.id)}
                          onCheckedChange={(checked: boolean | 'indeterminate') =>
                            handleChildToggle(child.id, checked === true)
                          }
                        />
                        <span className="text-sm">
                          {child.firstName} {child.lastName}
                        </span>
                        {child.schoolLevel && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {child.schoolLevel}
                          </span>
                        )}
                      </label>
                    ))}
                    {/* Premium children - already subscribed (display only) */}
                    {children?.filter((child: IChild) => {
                      const childStatus = childrenWithStatus.find(c => c.id === child.id);
                      return childStatus?.plan === 'premium';
                    }).map((child: IChild) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      >
                        <div className="h-4 w-4 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span className="text-sm text-green-700 dark:text-green-400">
                          {child.firstName} {child.lastName}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                          Déjà Premium
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Price Summary */}
                {childrenCount > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {childrenCount} enfant{childrenCount > 1 ? 's' : ''} sélectionné{childrenCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {formatPriceEuros(monthlyPrice)}/mois
                      </span>
                    </div>
                    {childrenCount > 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        15€ (1er) + {(childrenCount - 1) * 5}€ ({childrenCount - 1} × 5€)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="p-6 pt-4">
            <Button
              onClick={handleUpgrade}
              disabled={
                isCheckingOut ||
                isLoading ||
                childrenCount === 0 ||
                freeChildren.length === 0
              }
              size="lg"
              className="w-full"
            >
              {isCheckingOut || isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Chargement...
                </span>
              ) : freeChildren.length === 0 && premiumChildrenCount > 0 ? (
                'Tous vos enfants sont Premium'
              ) : childrenCount === 0 ? (
                'Sélectionnez un enfant'
              ) : (
                `Passer Premium - ${formatPriceEuros(monthlyPrice)}/mois`
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Trust Badges */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-500" />
          <span>Paiement sécurisé par Stripe</span>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-2">
          <span>Vos données sont protégées</span>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-2">
          <span>Annulation sans frais</span>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-16 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-center mb-8">
          Questions fréquentes
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">
              Comment fonctionne la tarification par enfant ?
            </h3>
            <p className="text-sm text-muted-foreground">
              Le premier enfant coûte 15€/mois. Chaque enfant supplémentaire ajoute
              seulement 5€/mois. Par exemple : 2 enfants = 20€/mois, 3 enfants = 25€/mois.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">
              Puis-je ajouter ou retirer des enfants ?
            </h3>
            <p className="text-sm text-muted-foreground">
              Oui ! L'ajout est immédiat avec facturation au prorata.
              Le retrait prend effet à la fin de la période payée (pas de remboursement,
              mais l'enfant garde l'accès Premium jusqu'au renouvellement).
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">
              Comment fonctionne l'annulation ?
            </h3>
            <p className="text-sm text-muted-foreground">
              Vous pouvez annuler depuis votre espace client. Tous vos enfants
              gardent l'accès Premium jusqu'à la fin de la période payée.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">
              Quels moyens de paiement acceptez-vous ?
            </h3>
            <p className="text-sm text-muted-foreground">
              Nous acceptons les cartes Visa, Mastercard, American Express et les
              virements SEPA via notre partenaire Stripe.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
