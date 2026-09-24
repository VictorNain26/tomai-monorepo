import Link from "next/link";
import { cn } from "@repo/ui";
import { BRAND_NAME } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND_NAME} - Accueil`}
      className={cn(
        "inline-flex min-h-11 items-center font-heading text-2xl font-extrabold text-primary transition-opacity duration-base hover:opacity-80",
        className,
      )}
    >
      {BRAND_NAME}
    </Link>
  );
}
