/**
 * SubscriptionSuccess - Post-checkout success page
 *
 * Shown after successful Stripe payment
 */

import { type ReactElement, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, ArrowRight, PartyPopper } from 'lucide-react';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { getPlanDisplayName } from '@/lib/subscription';

export default function SubscriptionSuccess(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { status, refetch, isLoading } = useSubscription();

  // Refetch subscription status on mount to get updated plan
  useEffect(() => {
    if (sessionId) {
      // Give Stripe webhook time to process
      const timer = setTimeout(() => {
        void refetch();
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [sessionId, refetch]);

  const handleContinue = () => {
    void navigate('/student');
  };

  return (
    <PageContainer className="max-w-lg flex items-center justify-center min-h-[60vh]">
      <Card className="w-full">
        <CardContent className="pt-8 pb-8 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="absolute -top-1 -right-1">
                <PartyPopper className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">
            Bienvenue dans TomIA Premium !
          </h1>

          {/* Subtitle with plan name */}
          <p className="text-muted-foreground mb-6">
            {isLoading ? (
              'Activation de votre abonnement...'
            ) : status ? (
              <>
                Votre plan <strong>{getPlanDisplayName(status.plan)}</strong> est maintenant actif.
              </>
            ) : (
              'Votre abonnement a été activé avec succès.'
            )}
          </p>

          {/* Benefits reminder */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-medium mb-3">Ce qui vous attend :</p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Questions illimitées avec TomIA
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Accès à toutes les matières
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Support prioritaire
              </li>
            </ul>
          </div>

          {/* CTA Button */}
          <Button onClick={handleContinue} size="lg" className="w-full">
            Commencer à apprendre
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          {/* Session ID (for debugging) */}
          {sessionId && import.meta.env.DEV && (
            <p className="mt-4 text-xs text-muted-foreground">
              Session: {sessionId.slice(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
