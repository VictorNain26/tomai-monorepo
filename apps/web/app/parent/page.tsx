import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export default function ParentDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord parent</h1>
        <p className="text-muted-foreground">Suivez la progression de vos enfants.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mes enfants</CardTitle>
            <CardDescription>Comptes liés et activité récente.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aucun enfant lié pour le moment.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Abonnement</CardTitle>
            <CardDescription>État de votre formule.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Gratuit — gestion via l&apos;app mobile (RevenueCat).
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
