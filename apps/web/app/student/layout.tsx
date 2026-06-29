import { DashboardShell, type NavItem } from "@/components/dashboard-shell";

const nav: NavItem[] = [
  { href: "/student", label: "Accueil" },
  { href: "/student/chat", label: "Chat" },
  { href: "/student/revisions", label: "Révisions" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="student" nav={nav}>
      {children}
    </DashboardShell>
  );
}
