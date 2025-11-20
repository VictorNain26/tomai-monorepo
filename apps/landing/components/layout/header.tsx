"use client";

import Link from "next/link";
import { Brain, Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

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
      <nav className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">TomIA</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Méthode
          </Link>
          <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Fonctionnalités
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Tarifs
          </Link>
          <Link href="#faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            FAQ
          </Link>
        </div>

        {/* Desktop CTA & Theme Toggle */}
        <div className="hidden md:flex items-center gap-4">
          {mounted && (
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">Changer de thème</span>
            </Button>
          )}
          <Link href="http://localhost:5173/auth/login">
            <Button variant="ghost" size="sm">
              Connexion
            </Button>
          </Link>
          <Link href="http://localhost:5173/auth/register">
            <Button size="sm">
              Essai gratuit
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
          {mounted && (
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <button
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
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
          <Link
            href="#how-it-works"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Méthode
          </Link>
          <Link
            href="#features"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Fonctionnalités
          </Link>
          <Link
            href="#pricing"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Tarifs
          </Link>
          <Link
            href="#faq"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            FAQ
          </Link>
          <div className="pt-4 space-y-2">
            <Link href="http://localhost:5173/auth/login" className="block">
              <Button variant="outline" className="w-full">
                Connexion
              </Button>
            </Link>
            <Link href="http://localhost:5173/auth/register" className="block">
              <Button className="w-full">
                Essai gratuit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
