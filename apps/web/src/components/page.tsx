import type { ReactNode } from 'react';

/** A screen at phone width first: one column, its title, then its content. */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4">
      <h1 className="pt-8 text-3xl font-bold text-foreground">{title}</h1>
      {children}
    </main>
  );
}
