/**
 * PricingCard - Elegant pricing card component
 *
 * Displays subscription plan with per-child pricing model
 * First child: 15€/month, Additional: +5€/month each
 */

import { type ReactElement } from 'react';
import { Check, Sparkles, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ISubscriptionPlan, SubscriptionPlanType } from '@/types';
import { formatPriceEuros, PRICING_INFO } from '@/lib/subscription';

interface PricingCardProps {
  plan: ISubscriptionPlan;
  currentPlan?: SubscriptionPlanType;
  onSelect: (planKey: SubscriptionPlanType) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Number of children for price calculation (premium only) */
  childrenCount?: number;
}

const planIcons: Record<SubscriptionPlanType, ReactElement> = {
  free: <Sparkles className="h-5 w-5" />,
  premium: <Crown className="h-5 w-5" />,
};

export function PricingCard({
  plan,
  currentPlan,
  onSelect,
  isLoading = false,
  disabled = false,
  childrenCount = 1,
}: PricingCardProps): ReactElement {
  const isCurrentPlan = currentPlan === plan.key;
  const isUpgrade = !currentPlan || currentPlan === 'free';
  const isFree = plan.key === 'free';
  const isPremium = plan.key === 'premium';

  // Calculate price for premium based on children count
  const monthlyPrice = isPremium ? PRICING_INFO.calculateTotal(childrenCount) : 0;

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-all duration-300',
        plan.highlighted && 'border-primary shadow-lg scale-[1.02] md:scale-105',
        isCurrentPlan && 'ring-2 ring-primary/50'
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            variant={plan.highlighted ? 'default' : 'secondary'}
            className="px-3 py-1 text-xs font-medium"
          >
            {plan.badge}
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pt-8 pb-4">
        {/* Icon */}
        <div
          className={cn(
            'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            plan.highlighted
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {planIcons[plan.key]}
        </div>

        <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>

        {/* Price */}
        <div className="mt-4">
          {isFree ? (
            <span className="text-4xl font-bold tracking-tight">Gratuit</span>
          ) : (
            <>
              <span className="text-4xl font-bold tracking-tight">
                {formatPriceEuros(monthlyPrice)}
              </span>
              <span className="text-muted-foreground ml-1">/mois</span>
            </>
          )}
        </div>

        {/* Per-child pricing info */}
        {isPremium && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span>1er enfant: 15€</span>
            <span className="mx-1">•</span>
            <span>+5€/enfant supplémentaire</span>
          </div>
        )}

        <CardDescription className="mt-2">
          {plan.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 px-6">
        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  plan.highlighted ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                <Check className="h-3 w-3" />
              </div>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="p-6 pt-4">
        <Button
          onClick={() => onSelect(plan.key)}
          disabled={disabled || isLoading || (isCurrentPlan && !isFree)}
          variant={plan.highlighted ? 'default' : 'outline'}
          size="lg"
          className="w-full"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Chargement...
            </span>
          ) : isCurrentPlan ? (
            'Plan actuel'
          ) : isFree ? (
            'Continuer gratuitement'
          ) : isUpgrade ? (
            'Passer Premium'
          ) : (
            'Changer de plan'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
