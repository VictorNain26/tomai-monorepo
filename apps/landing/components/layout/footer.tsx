import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { Logo } from "../atoms/logo";

const LINK_GROUPS = [
  {
    title: "Produit",
    links: [
      { href: "/#how-it-works", label: "Comment ça marche" },
      { href: "/#parents", label: "Parents" },
      { href: "/#pricing", label: "Tarifs" },
    ],
  },
  {
    title: "Aide",
    links: [
      { href: "/aide", label: "Centre d'aide" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cgu", label: "CGU" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              En préparation&nbsp;: une aide aux devoirs pour que, le soir, ce ne soit plus au parent
              d&apos;expliquer, ni à l&apos;IA de faire l&apos;exercice.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Modèles de Mistral AI, appelés en Europe</li>
              <li>Sans publicité</li>
              <li>Un service web, pensé d&apos;abord pour le téléphone</li>
            </ul>
          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="mb-4 text-sm font-bold text-muted-foreground">{group.title}</p>
              <ul className="space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 min-w-11 items-center text-foreground underline-offset-4 transition-colors duration-base hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {BRAND_NAME}. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
