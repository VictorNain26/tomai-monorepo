import Link from "next/link";
import { cn } from "@repo/ui";

interface NavLinksProps {
  className?: string;
  onLinkClick?: () => void;
  orientation?: "horizontal" | "vertical";
}

const LINKS = [
  { href: "/#how-it-works", label: "Comment ça marche" },
  { href: "/#parents", label: "Parents" },
  { href: "/#pricing", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
];

export function NavLinks({
  className,
  onLinkClick,
  orientation = "horizontal"
}: NavLinksProps) {
  return (
    <div className={cn(
      "flex",
      orientation === "vertical" ? "flex-col space-y-4" : "items-center gap-8",
      className
    )}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-base",
            orientation === "vertical" && "flex min-h-11 items-center"
          )}
          onClick={onLinkClick}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
