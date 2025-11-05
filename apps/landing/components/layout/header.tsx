"use client";

import Link from "next/link";
import { Brain, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">TomAI</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#features"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Fonctionnalités
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Comment ça marche
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Tarifs
          </Link>
          <Link
            href="#testimonials"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Témoignages
          </Link>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
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
        <button
          className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden border-b border-border bg-background",
          mobileMenuOpen ? "block" : "hidden"
        )}
      >
        <div className="container py-4 space-y-4">
          <Link
            href="#features"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Fonctionnalités
          </Link>
          <Link
            href="#how-it-works"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Comment ça marche
          </Link>
          <Link
            href="#pricing"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Tarifs
          </Link>
          <Link
            href="#testimonials"
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Témoignages
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
