import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SchoolDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Espace établissement</h1>
        <p className="text-muted-foreground">Console de suivi pour les équipes pédagogiques.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bientôt disponible</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          La console établissement (classes, suivi, reporting) sera développée lors de la
          phase B2B, en réutilisant le backend et le design system partagés.
        </CardContent>
      </Card>
    </div>
  );
}
