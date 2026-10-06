import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold text-foreground">Tom</h1>
      <p className="text-muted-foreground">L’application arrive bientôt.</p>
    </main>
  );
}
