import { cn } from "@repo/ui";

export function MarginNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("-rotate-2 font-heading text-lg text-balance italic text-annotation", className)}>{children}</p>
  );
}
