import Link from "next/link";
import type { Role } from "@/lib/roles";
import { ROLE_LABEL } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";

export interface NavItem {
  href: string;
  label: string;
}

interface DashboardShellProps {
  role: Role;
  nav: NavItem[];
  children: React.ReactNode;
}

/**
 * Shell de dashboard générique (template) : sidebar + zone contenu.
 * Réutilisé par chaque espace rôle. Design volontairement minimal.
 */
export function DashboardShell({ role, nav, children }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card p-4">
        <div className="mb-6 px-2">
          <p className="text-lg font-bold">Tom</p>
          <p className="text-sm text-muted-foreground">{ROLE_LABEL[role]}</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
