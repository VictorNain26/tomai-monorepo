import { cn } from "@/lib/utils";

interface HeroBadgeProps {
  className?: string;
}

export function HeroBadge({ className }: HeroBadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 backdrop-blur-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700",
      className
    )}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-xs font-medium text-muted-foreground">
        Conforme aux programmes 2024-2025
      </span>
    </div>
  );
}
