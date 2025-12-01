/**
 * SubscriptionCancel - Checkout canceled page
 *
 * Shown when user cancels Stripe checkout
 */

import { type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { XCircle, ArrowLeft, RefreshCcw } from 'lucide-react';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SubscriptionCancel(): ReactElement {
  const navigate = useNavigate();

  const handleTryAgain = () => {
    void navigate('/subscription/pricing');
  };

  const handleGoBack = () => {
    void navigate('/student');
  };

  return (
    <PageContainer className="max-w-lg flex items-center justify-center min-h-[60vh]">
      <Card className="w-full">
        <CardContent className="pt-8 pb-8 text-center">
          {/* Cancel Icon */}
          <div className="mb-6 flex justify-center">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <XCircle className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">
            Paiement annulé
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground mb-6">
            Pas de souci ! Vous pouvez toujours utiliser TomIA gratuitement
            ou réessayer quand vous le souhaitez.
          </p>

          {/* Reassurance */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            <p>
              Aucun montant n'a été prélevé. Votre compte reste inchangé.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au dashboard
            </Button>
            <Button
              onClick={handleTryAgain}
              className="flex-1"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
