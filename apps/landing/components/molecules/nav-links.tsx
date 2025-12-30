import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavLinksProps {
  className?: string;
  onLinkClick?: () => void;
  orientation?: "horizontal" | "vertical";
}

const LINKS = [
  { href: "/#how-it-works", label: "Méthode" },
  { href: "/#features", label: "Fonctionnalités" },
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
            "text-sm font-medium text-muted-foreground hover:text-primary transition-colors",
            orientation === "vertical" && "block py-2"
          )}
          onClick={onLinkClick}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
