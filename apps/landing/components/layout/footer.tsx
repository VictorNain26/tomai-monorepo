import Link from "next/link";
import { MapPin, ShieldCheck, Server, Lock, Globe } from "lucide-react";
import { Logo } from "../atoms/logo";
import { BRAND_NAME } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <Logo />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              L&apos;assistant qui aide les élèves français à comprendre leurs leçons, sans donner les réponses.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span>RGPD</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Server className="h-4 w-4 text-success" />
                <span>Hébergé en Europe</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-4 w-4 text-success" />
                <span>Aucune publicité</span>
              </div>
            </div>

            {/* Web availability */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-4 w-4 text-success" />
              <span>Dans le navigateur, sur ordinateur, tablette ou téléphone</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Produit</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#parents" className="text-muted-foreground hover:text-primary transition-colors duration-base">
                  Parents
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-muted-foreground hover:text-primary transition-colors duration-base">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-muted-foreground hover:text-primary transition-colors duration-base">
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
                <Link href="/aide" className="text-muted-foreground hover:text-primary transition-colors duration-base">
                  Centre d&apos;aide
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors duration-base">
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
                <Link href="/confidentialite" className="text-muted-foreground hover:text-primary transition-colors duration-base">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="text-muted-foreground hover:text-primary transition-colors duration-base">
                  CGU
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="text-muted-foreground hover:text-primary transition-colors duration-base">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/60 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BRAND_NAME}. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>France</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
