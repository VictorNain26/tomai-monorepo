/**
 * StudentDashboard - Dashboard Élève Simplifié
 *
 * MVP: Header + Matières + Usage IA
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
import { isITomUser, type IWindowUsage } from '@/types';

/** Default window usage when no data available */
const DEFAULT_WINDOW: IWindowUsage = {
  tokensUsed: 0,
  tokensRemaining: 5_000,
  limit: 5_000,
  usagePercent: 0,
  refreshIn: '5h 0min',
};

export default function StudentDashboard(): ReactElement {
  const user = useUser();
  const navigate = useNavigate();
  const { subjects, sessions, mode, isLoading, isRAGEmpty } =
    useStudentDashboard();
  const { window: windowUsage, plan, isLoading: usageLoading } = useTokenUsage({
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
      {/* Header */}
      <div className="mb-8">
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

      {/* Token Usage Card - Affichage rolling window pour l'élève */}
      {!usageLoading && windowUsage && (
        <UsageCard
          windowUsage={windowUsage ?? DEFAULT_WINDOW}
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
