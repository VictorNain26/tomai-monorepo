/**
 * StudentBadges - Page Badges Ultra-Simplifiée
 *
 * Structure PLATE sans wrappers inutiles.
 * Design moderne et épuré.
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - TypeScript strict mode
 * - Structure flat minimale
 */

import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { useStudentGamification } from '@/hooks/useStudentGamification';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { BadgesHeader } from '@/components/badges/organisms/BadgesHeader';
import { BadgeGrid } from '@/components/badges/BadgeGrid';

export default function StudentBadges(): ReactElement {
  const navigate = useNavigate();
  const { mode } = useStudentDashboard();
  const { data, isLoading, isError, error, refetch } = useStudentGamification();

  // Error state
  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title={mode === 'primary' ? 'Oups ! Erreur de chargement' : 'Erreur de chargement des badges'}
          description={
            mode === 'primary'
              ? 'Impossible de charger tes badges. Réessaie dans quelques instants !'
              : `Une erreur est survenue lors du chargement des badges. ${error instanceof Error ? error.message : ''}`
          }
          mode={mode}
          onRetry={refetch}
          onBack={() => navigate('/student/dashboard')}
          backLabel="Retour au dashboard"
        />
      </PageContainer>
    );
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  const { stats, allBadges } = data;

  // Normal state - Structure PLATE
  return (
    <PageContainer>
      {/* Header avec compteur intégré */}
      <BadgesHeader
        mode={mode}
        onBack={() => navigate('/student/dashboard')}
        badgesUnlocked={stats.totalBadgesUnlocked}
        badgesTotal={stats.totalBadgesAvailable}
      />

      {/* Titre section */}
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        Tous les badges
      </h2>

      {/* Grille badges DIRECTE - sans wrappers */}
      <BadgeGrid
        badges={allBadges}
        mode={mode}
        showDescription={true}
      />
    </PageContainer>
  );
}
