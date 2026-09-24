import { cn } from "@repo/ui";

interface SectionHeaderProps {
  as?: "h1" | "h2";
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeader({ as: Heading = "h2", eyebrow, title, description, align = "center", className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-16 max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left", className)}>
      {eyebrow && <p className="mb-4 font-heading text-lg italic text-annotation">{eyebrow}</p>}
      <Heading className="text-4xl font-semibold text-balance text-foreground sm:text-5xl">{title}</Heading>
      {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
    </div>
  );
}
