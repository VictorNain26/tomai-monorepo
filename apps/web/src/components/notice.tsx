import type { ReactNode } from 'react';

/** A message of the form as a whole: an error read out at once, or a confirmation. */
export function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return tone === 'error' ? (
    <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
      {children}
    </p>
  );
}
