import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";

export default function ParentChildrenPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Mes enfants</h1>
      <Card>
        <CardHeader>
          <CardTitle>Comptes liés</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          La gestion des comptes enfants arrivera ici.
        </CardContent>
      </Card>
    </div>
  );
}
