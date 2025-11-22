"use client";

import Link from "next/link";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { APP_URL } from "@/lib/urls";
import { Logo } from "../atoms/logo";
import { NavLinks } from "../molecules/nav-links";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Effet scroll subtil
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    setMounted(true);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-200",
        scrolled
          ? "bg-background/95 backdrop-blur-md border-border/60 shadow-sm"
          : "bg-background/95 backdrop-blur border-border/40"
      )}
    >
      <nav className="container relative flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center z-20">
          <Logo />
        </div>

        {/* Desktop Navigation - Centered */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <NavLinks />
        </div>

        {/* Desktop CTA & Theme Toggle */}
        <div className="hidden md:flex items-center gap-3 z-20">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
              aria-label="Changer de thème"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          )}
          <Link href={APP_URL}>
            <Button size="sm">Commencer gratuitement</Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden z-20">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
              aria-label="Changer de thème"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-200 ease-in-out border-t border-border/50",
          mobileMenuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0 border-t-0"
        )}
      >
        <div className="container px-4 py-4 space-y-4 bg-background">
          <NavLinks
            orientation="vertical"
            onLinkClick={() => setMobileMenuOpen(false)}
          />
          <div className="pt-2">
            <Link href={APP_URL} className="block">
              <Button className="w-full">Commencer gratuitement</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
