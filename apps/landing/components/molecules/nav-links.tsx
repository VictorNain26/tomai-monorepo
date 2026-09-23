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
      orientation === "vertical" ? "flex-col space-y-4" : "items-center gap-4",
      className
    )}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-base",
            orientation === "vertical" ? "flex" : "inline-flex px-2"
          )}
          onClick={onLinkClick}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
