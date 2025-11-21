import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Logo } from "../atoms/logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Logo />
            <p className="text-sm text-muted-foreground max-w-xs">
              L&apos;assistant pédagogique qui accompagne les étudiants français avec la méthode socratique adaptative.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Produit</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#features" className="text-muted-foreground hover:text-primary transition-colors">
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
                  Comment ça marche
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Support</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/aide" className="text-muted-foreground hover:text-primary transition-colors">
                  Centre d&apos;aide
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Légal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/confidentialite" className="text-muted-foreground hover:text-primary transition-colors">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="text-muted-foreground hover:text-primary transition-colors">
                  CGU
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="text-muted-foreground hover:text-primary transition-colors">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 TomIA. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>France</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>contact@tomai.fr</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
