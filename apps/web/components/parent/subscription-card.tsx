"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
} from "@repo/ui";
import { useSubscriptionStatus } from "@/lib/hooks/use-subscription-status";

// ============================================================================
// HELPERS
// ============================================================================

function planLabel(plan: string): string {
  return plan === "premium" ? "Premium" : "Gratuit";
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Actif";
    case "inactive":
      return "Inactif";
    case "cancelled":
      return "Annulé";
    case "past_due":
      return "Paiement en retard";
    default:
      return status;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SubscriptionCard() {
  const { data, isLoading, isError } = useSubscriptionStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-56" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
          <CardDescription>État de votre formule famille.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Impossible de charger l&apos;abonnement. Réessayez plus tard.
        </CardContent>
      </Card>
    );
  }

  const isPremium = data.plan === "premium";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abonnement</CardTitle>
        <CardDescription>État de votre formule famille.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={isPremium ? "default" : "secondary"}>
            {planLabel(data.plan)}
          </Badge>
          <Badge variant="outline">{statusLabel(data.status)}</Badge>
        </div>

        {data.billing && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {data.billing.premiumChildrenCount > 0 && (
              <>
                <dt className="text-muted-foreground">Enfants premium</dt>
                <dd className="font-medium">
                  {data.billing.premiumChildrenCount}
                </dd>
              </>
            )}
            {data.billing.monthlyAmountCents > 0 && (
              <>
                <dt className="text-muted-foreground">Montant mensuel</dt>
                <dd className="font-medium">{data.billing.monthlyAmount}</dd>
              </>
            )}
          </dl>
        )}

        <p className="text-xs text-muted-foreground">
          La gestion de l&apos;abonnement se fait via l&apos;application mobile.
        </p>
      </CardContent>
    </Card>
  );
}
