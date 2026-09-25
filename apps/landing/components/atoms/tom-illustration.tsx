import { cn } from "@repo/ui";

export function TomIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" data-testid="tom" className={cn("aspect-square w-full max-w-sm", className)}>
      <div className="size-full rounded-full bg-secondary" />
    </div>
  );
}
