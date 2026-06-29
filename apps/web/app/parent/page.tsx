"use client";

import Link from "next/link";
import { Button, Skeleton } from "@repo/ui";
import { useParentDashboard } from "@/lib/hooks/use-parent-dashboard";
import { ChildCard } from "@/components/parent/child-card";
import { SubscriptionCard } from "@/components/parent/subscription-card";

// ============================================================================
// LOADING STATE
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function ParentDashboardPage() {
  const {
    children,
    childrenCount,
    isLoading,
    isError,
    errorMessage,
    metrics,
    userName,
    refresh,
  } = useParentDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord parent</h1>
        </div>
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium mb-2">
            {errorMessage ?? "Une erreur est survenue lors du chargement."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="min-h-[44px]"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {userName}</h1>
        <p className="text-muted-foreground">
          {childrenCount > 0
            ? `${childrenCount} enfant${childrenCount > 1 ? "s" : ""} lié${childrenCount > 1 ? "s" : ""}`
            : "Aucun enfant lié pour le moment."}
        </p>
      </div>

      {/* Empty state */}
      {children.length === 0 ? (
        <section
          aria-label="Aucun enfant lié"
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-10 text-center"
        >
          <p className="text-muted-foreground">
            Ajoutez un enfant pour commencer à suivre sa progression.
          </p>
          <Button asChild className="min-h-[44px]">
            <Link href="/parent/enfants">Ajouter un enfant</Link>
          </Button>
        </section>
      ) : (
        /* Children grid */
        <section aria-label="Enfants liés">
          <h2 className="sr-only">Enfants liés</h2>
          <ul className="grid gap-4 sm:grid-cols-2" role="list">
            {children.map((child) => {
              const childMetrics = metrics.find(
                (m) => m.studentId === child.id
              );
              return (
                <li key={child.id}>
                  <ChildCard child={child} metrics={childMetrics} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Subscription */}
      <section aria-label="Abonnement famille">
        <SubscriptionCard />
      </section>
    </div>
  );
}
