"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
  Badge,
} from "@repo/ui";
import type { IChild, ChildMetrics } from "@/lib/hooks/use-parent-dashboard";

// ============================================================================
// HELPERS
// ============================================================================

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

// ============================================================================
// PROPS
// ============================================================================

interface ChildCardProps {
  child: IChild;
  metrics?: ChildMetrics;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildCard({ child, metrics }: ChildCardProps) {
  const initials = getInitials(child.firstName, child.lastName);
  const fullName = `${child.firstName} ${child.lastName}`.trim();
  const studyTime = metrics?.totalStudyTime ?? 0;
  const sessions = metrics?.totalSessions ?? 0;

  return (
    <Link
      href={`/parent/enfants`}
      aria-label={`Voir le profil de ${fullName}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer min-h-[44px]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarFallback aria-hidden="true">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{fullName}</CardTitle>
              <p className="text-sm text-muted-foreground truncate">
                @{child.username}
              </p>
            </div>
            {child.schoolLevel && (
              <Badge variant="secondary" className="shrink-0">
                {child.schoolLevel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className="flex gap-4 text-sm text-muted-foreground"
            aria-label={`Activité de ${fullName}`}
          >
            <span>
              <span className="font-medium text-foreground">{sessions}</span>{" "}
              session{sessions !== 1 ? "s" : ""}
            </span>
            {studyTime > 0 && (
              <span>
                <span className="font-medium text-foreground">
                  {formatStudyTime(studyTime)}
                </span>{" "}
                de travail
              </span>
            )}
            {!child.isActive && (
              <Badge variant="outline" className="text-xs">
                Inactif
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
