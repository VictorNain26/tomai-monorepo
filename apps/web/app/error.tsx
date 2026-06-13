"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted-foreground">
        Quelque chose s&apos;est mal passé. Vous pouvez réessayer.
      </p>
      <Button type="button" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
