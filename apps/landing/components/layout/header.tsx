"use client";

import Link from "next/link";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { APP_URL } from "@/lib/urls";
import { Logo } from "../atoms/logo";
import { NavLinks } from "../molecules/nav-links";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container relative flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center z-20">
          <Logo />
        </div>

        {/* Desktop Navigation - Centered Absolutely */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <NavLinks />
        </div>

        {/* Desktop CTA & Theme Toggle */}
        <div className="hidden md:flex items-center gap-4 z-20">
          {mounted && (
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">Changer de thème</span>
            </Button>
          )}
          <Link href={APP_URL}>
            <Button size="sm">
              Essayer gratuitement
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden z-20">
          {mounted && (
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
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
          "md:hidden border-b border-border bg-background",
          mobileMenuOpen ? "block" : "hidden"
        )}
      >
        <div className="container px-4 py-4 space-y-4">
          <NavLinks
            orientation="vertical"
            onLinkClick={() => setMobileMenuOpen(false)}
          />
          <div className="pt-4">
            <Link href={APP_URL} className="block">
              <Button className="w-full">
                Essayer gratuitement
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
