import { BookOpen, ShieldCheck, Server, Lock } from "lucide-react";

const BADGES = [
  {
    icon: BookOpen,
    label: "415 programmes Éduscol",
  },
  {
    icon: ShieldCheck,
    label: "Conforme RGPD",
  },
  {
    icon: Server,
    label: "Hébergé en Europe",
  },
  {
    icon: Lock,
    label: "Aucune publicité",
  },
];

export function TrustBadges() {
  return (
    <section className="py-8 border-y border-border/40">
      <div className="container px-4 mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {BADGES.map((badge) => (
            <div key={badge.label} className="flex items-center gap-2.5">
              <badge.icon className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
