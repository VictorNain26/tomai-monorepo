"use client";

import { Button, cn } from "@repo/ui";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Logo } from "../atoms/logo";
import { NavLinks } from "../molecules/nav-links";
import { MobileMenu } from "../molecules/mobile-menu";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-base",
        scrolled ? "border-border bg-background/90 backdrop-blur-md" : "border-transparent bg-background/70 backdrop-blur",
      )}
    >
      <nav aria-label="Principale" className="container relative flex h-16 items-center justify-between">
        <div className="flex items-center z-20">
          <Logo />
        </div>

        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <NavLinks />
        </div>

        <div className="hidden md:flex items-center gap-3 z-20">
          <Button size="sm" asChild>
            <Link href="/#waitlist">S&apos;inscrire</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden z-20">
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}
