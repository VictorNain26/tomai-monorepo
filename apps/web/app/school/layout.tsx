import { DashboardShell, type NavItem } from "@/components/dashboard-shell";

const nav: NavItem[] = [{ href: "/school", label: "Tableau de bord" }];

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="school" nav={nav}>
      {children}
    </DashboardShell>
  );
}
