/**
 * SubscriptionStatusCard - Full subscription status display
 *
 * Shows detailed subscription info with management actions
 * Per-child pricing with pending removal handling
 */

import { type ReactElement } from 'react';
import { CreditCard, Calendar, ExternalLink, AlertTriangle, Users, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SubscriptionBadge } from './SubscriptionBadge';
import {
  formatPeriodEnd,
  getPlanDisplayName,
  isPremiumActive,
  isCanceledButActive,
  hasPendingChanges,
  formatPriceEuros,
} from '@/lib/subscription';
import type { ISubscriptionStatus } from '@/types';

interface SubscriptionStatusCardProps {
  status: ISubscriptionStatus;
  onManageSubscription: () => void;
  onUpgrade: () => void;
  onResumeSubscription?: () => void;
  isLoading?: boolean;
}

export function SubscriptionStatusCard({
  status,
  onManageSubscription,
  onUpgrade,
  onResumeSubscription,
  isLoading = false,
}: SubscriptionStatusCardProps): ReactElement {
  const isPremium = isPremiumActive(status);
  const isCanceled = isCanceledButActive(status);
  const hasPending = hasPendingChanges(status);
  const premiumChildrenCount = status.billing?.premiumChildrenCount ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Abonnement</CardTitle>
            <CardDescription>Gérez votre plan TomIA</CardDescription>
          </div>
          <SubscriptionBadge
            plan={status.plan}
            status={status.status}
            showStatus
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cancellation Warning */}
        {isCanceled && status.subscription && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-2">
              <span>
                Votre abonnement sera annulé le{' '}
                <strong>{formatPeriodEnd(status.subscription.currentPeriodEnd)}</strong>.
              </span>
              {onResumeSubscription && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResumeSubscription}
                  disabled={isLoading}
                  className="w-fit"
                >
                  Réactiver l'abonnement
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Removal Warning */}
        {hasPending && status.subscription && !isCanceled && (
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <Clock className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              <span className="text-amber-700 dark:text-amber-400">
                Modifications prévues le{' '}
                <strong>{formatPeriodEnd(status.subscription.currentPeriodEnd)}</strong>:
                {status.subscription.scheduledChildrenCount !== undefined && (
                  <span>
                    {' '}
                    {status.subscription.scheduledChildrenCount} enfant(s) Premium
                    {status.subscription.scheduledMonthlyAmountCents && (
                      <> ({formatPriceEuros(status.subscription.scheduledMonthlyAmountCents / 100)}/mois)</>
                    )}
                  </span>
                )}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Past Due Warning */}
        {status.status === 'past_due' && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Un paiement est en attente. Veuillez mettre à jour votre moyen de paiement.
            </AlertDescription>
          </Alert>
        )}

        {/* Subscription Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Plan:</span>
            <span className="font-medium">{getPlanDisplayName(status.plan)}</span>
          </div>

          {isPremium && (
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Enfants Premium:</span>
              <span className="font-medium">
                {premiumChildrenCount} ({status.billing?.monthlyAmount ?? '0€'}/mois)
              </span>
            </div>
          )}

          {status.subscription?.currentPeriodEnd && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {isCanceled ? 'Fin d\'accès:' : 'Prochain renouvellement:'}
              </span>
              <span className="font-medium">
                {formatPeriodEnd(status.subscription.currentPeriodEnd)}
              </span>
            </div>
          )}
        </div>

        {/* Children Status List */}
        {status.children && status.children.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Vos enfants:</p>
            <ul className="space-y-1">
              {status.children.map((child) => (
                <li key={child.id} className="flex items-center justify-between text-sm">
                  <span>{child.name || child.username}</span>
                  <span
                    className={
                      child.plan === 'premium'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                    }
                  >
                    {child.plan === 'premium' ? 'Premium' : 'Gratuit'}
                    {child.status === 'pending_removal' && (
                      <span className="ml-1 text-xs">(fin prévue)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {isPremium ? (
            <Button
              variant="outline"
              onClick={onManageSubscription}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Gérer l'abonnement
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onUpgrade}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                'Passer Premium'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
