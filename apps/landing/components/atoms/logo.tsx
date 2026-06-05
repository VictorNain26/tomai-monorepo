import Link from "next/link";
import Image from "next/image";
import { cn } from "@repo/ui";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 hover:opacity-90 transition-opacity", className)}
      aria-label="TomIA - Accueil"
    >
      <Image
        src="/logo.svg"
        alt="TomIA"
        width={120}
        height={48}
        className="h-8 w-auto"
        priority
      />
    </Link>
  );
}
