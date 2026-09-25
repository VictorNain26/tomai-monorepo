import { cn } from "@repo/ui";

export function HandNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("-rotate-2 font-hand text-2xl font-semibold text-balance text-annotation", className)}>{children}</p>
  );
}
