import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour 👋</h1>
        <p className="text-muted-foreground">Prêt à réviser aujourd&apos;hui ?</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Discuter avec Tom</CardTitle>
            <CardDescription>Pose une question sur tes leçons.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Le chat arrivera ici.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Révisions</CardTitle>
            <CardDescription>Tes cartes à revoir.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aucune révision en attente.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
