import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
  align?: "center" | "left";
}

export function SectionHeader({
  title,
  description,
  className,
  align = "center"
}: SectionHeaderProps) {
  return (
    <div className={cn(
      "max-w-3xl mb-16",
      align === "center" ? "mx-auto text-center" : "text-left",
      className
    )}>
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-lg text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
