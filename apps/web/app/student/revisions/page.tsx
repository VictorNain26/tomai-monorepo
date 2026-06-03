import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentRevisionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Révisions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Cartes du jour</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          La révision espacée (FSRS) arrivera ici.
        </CardContent>
      </Card>
    </div>
  );
}
