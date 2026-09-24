import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

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
            <p className="font-heading text-2xl font-extrabold text-primary">{BRAND_NAME}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              L&apos;assistant qui aide les collégiens à comprendre leurs leçons, sans faire leurs exercices à leur place.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Hébergé dans l&apos;Union européenne</li>
              <li>Sans publicité</li>
              <li>Dans le navigateur, sur ordinateur, tablette ou téléphone</li>
            </ul>
          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="mb-4 text-sm font-semibold text-muted-foreground">{group.title}</p>
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
