/**
 * DashboardSubjectsSection - Sélection Matières Simplifiée
 *
 * Organism minimaliste : QuickStart + Grid matières.
 * Sans textes redondants, focus sur l'action.
 */

import { type ReactElement, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SubjectsGrid } from '@/components/dashboard/molecules/SubjectsGrid';
import { QuickStartCTA } from '@/components/dashboard/molecules/QuickStartCTA';
import type { EducationSubject, IStudySession } from '@/types';

export interface DashboardSubjectsSectionProps {
  subjects: EducationSubject[];
  sessions: IStudySession[];
  onSubjectClick: (subject: string) => void;
  onContinueSession: (sessionId: string) => void;
  mode?: 'primary' | 'college' | 'lycee';
  isRAGEmpty?: boolean;
  onRefreshRAG?: (() => void) | undefined;
  isLoading?: boolean;
  className?: string | undefined;
}

export function DashboardSubjectsSection({
  subjects,
  sessions,
  onSubjectClick,
  onContinueSession,
  mode = 'lycee',
  isRAGEmpty = false,
  onRefreshRAG,
  isLoading = false,
  className
}: DashboardSubjectsSectionProps): ReactElement {
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        {/* Quick Start skeleton */}
        <Card className="mb-4 border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-11 w-28 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-muted">
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="w-16 h-16 mx-auto rounded-xl" />
                <Skeleton className="h-5 w-32 mx-auto" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Logique suggestion matière
  const recentSession = sessions.length > 0 ? (sessions[0] ?? null) : null;
  const suggestedSubject = recentSession
    ? subjects.find((s) => s.name === recentSession.subject || s.key === recentSession.subject) ?? null
    : subjects.length > 0
      ? subjects[0]
      : null;

  // Matières principales (4 premières) vs toutes
  const mainSubjects = subjects.slice(0, 4);
  const hasMoreSubjects = subjects.length > 4;
  const displayedSubjects = showAllSubjects ? subjects : mainSubjects;

  // Normal state
  return (
    <div className={className}>
      {/* Quick Start CTA - Action primaire */}
      {suggestedSubject && (
        <QuickStartCTA
          suggestedSubject={suggestedSubject}
          recentSession={recentSession}
          onStartNew={onSubjectClick}
          onContinueSession={onContinueSession}
          mode={mode}
          className="mb-8"
        />
      )}

      {/* Section titre matières */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {mode === 'primary' ? '📚 Mes matières' : 'Toutes les matières'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === 'primary'
            ? 'Clique sur une matière pour démarrer'
            : 'Sélectionnez une matière pour commencer votre apprentissage'}
        </p>
      </div>

      <SubjectsGrid
        subjects={displayedSubjects}
        onSubjectClick={onSubjectClick}
        mode={mode}
        isRAGEmpty={isRAGEmpty}
        onRefreshRAG={onRefreshRAG}
      />

      {/* Toggle expansion */}
      {hasMoreSubjects && (
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setShowAllSubjects(!showAllSubjects)}
            className="gap-2 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            {showAllSubjects ? (
              <>
                <ChevronUp className="h-5 w-5" />
                Afficher moins
              </>
            ) : (
              <>
                <ChevronDown className="h-5 w-5" />
                Voir toutes les matières ({subjects.length})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
