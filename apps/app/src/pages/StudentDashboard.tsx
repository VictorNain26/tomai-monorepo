/**
 * StudentDashboard - Dashboard Élève Simplifié avec Streak
 *
 * MVP: Header avec streak + Matières + Usage IA
 * Pas de liste sessions, juste le streak pour motivation
 */

import { type ReactElement } from 'react';
import { useUser } from '@/lib/auth';
import { useNavigate } from 'react-router';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { DashboardSubjectsSection } from '@/components/dashboard/organisms/DashboardSubjectsSection';
import { UsageCard } from '@/components/subscription';
import { Card } from '@/components/ui/card';
import { isITomUser } from '@/types';

export default function StudentDashboard(): ReactElement {
  const user = useUser();
  const navigate = useNavigate();
  const { subjects, sessions, streak, mode, isLoading, isRAGEmpty } =
    useStudentDashboard();
  const { usage, plan, isLoading: usageLoading } = useTokenUsage({
    userId: user?.id,
    enabled: !!user?.id,
  });

  // Navigation vers chat avec matière
  const handleStartChat = (subjectKey: string) => {
    void navigate(`/student/chat?subject=${encodeURIComponent(subjectKey)}`);
  };

  // Navigation vers session existante
  const handleContinueSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      void navigate(
        `/student/chat?sessionId=${encodeURIComponent(sessionId)}&subject=${encodeURIComponent(session.subject)}`
      );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  // Normal state
  return (
    <PageContainer>
      {/* Header avec Streak Badge */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {mode === 'primary'
              ? `👋 Salut ${(isITomUser(user) && user.firstName) ?? user?.name} !`
              : `Bonjour ${(isITomUser(user) && user.firstName) ?? user?.name}`}
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === 'primary'
              ? 'Choisis ta matière et commençons !'
              : 'Prêt à apprendre ? Sélectionnez une matière pour commencer.'}
          </p>
        </div>

        {/* Daily Streak Badge */}
        {streak !== undefined && (
          <Card className="px-4 py-3 bg-primary/10 border-primary/20 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="fire">🔥</span>
              <div>
                <p className="text-2xl font-bold text-primary">{streak}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {streak === 0
                    ? 'Commence aujourd\'hui'
                    : streak === 1
                    ? 'jour de suite'
                    : 'jours de suite'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Token Usage Card - Affichage pour l'élève */}
      {!usageLoading && usage && (
        <UsageCard
          usage={usage}
          plan={plan}
          className="mb-6"
        />
      )}

      {/* Matières (avec suggestion de session récente) */}
      <DashboardSubjectsSection
        subjects={subjects}
        sessions={sessions}
        onSubjectClick={handleStartChat}
        onContinueSession={handleContinueSession}
        mode={mode}
        isRAGEmpty={isRAGEmpty}
        onRefreshRAG={() => window.location.reload()}
      />
    </PageContainer>
  );
}
