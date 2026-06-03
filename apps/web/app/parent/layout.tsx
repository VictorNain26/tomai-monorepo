import { DashboardShell, type NavItem } from "@/components/dashboard-shell";

const nav: NavItem[] = [
  { href: "/parent", label: "Tableau de bord" },
  { href: "/parent/enfants", label: "Mes enfants" },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="parent" nav={nav}>
      {children}
    </DashboardShell>
  );
}
