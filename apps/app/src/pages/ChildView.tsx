/**
 * ChildView - Vue détaillée d'un enfant pour les parents
 *
 * Architecture parent-based Pronote:
 * - Un seul compte Pronote par parent (pas par enfant)
 * - Le parent mappe ses enfants Pronote aux enfants TomAI
 * - L'enfant affiché ici peut être mappé ou non à Pronote
 */

import { useUser } from '../lib/auth';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  School,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  FileText,
  BarChart3,
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';
import {
  useParentPronoteStatus,
  useChildMappings,
  type ChildMapping,
} from '@/hooks/useParentPronote';
import { useQueryClient } from '@tanstack/react-query';
import ConnectPronote from '@/components/modals/ConnectPronote';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { IChild } from '@/types';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';

// ===== PRONOTE SECTION COMPONENT =====

interface PronoteSectionProps {
  child: IChild;
  childMapping: ChildMapping | null;
  parentConnected: boolean;
  establishmentName?: string;
  lastSync?: string;
  onConnect: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  loading: boolean;
}

const PronoteSection: React.FC<PronoteSectionProps> = ({
  child,
  childMapping,
  parentConnected,
  establishmentName,
  lastSync,
  onConnect,
  onRefresh,
  onNavigate,
  loading,
}) => {
  // L'enfant est mappé si le parent est connecté ET un mapping existe pour cet enfant
  const isMapped = parentConnected && childMapping !== null;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <School className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Pronote</CardTitle>
              <p className="text-sm text-muted-foreground">
                Données scolaires officielles
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            title="Actualiser"
            className="hover:bg-primary/10 text-primary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isMapped && childMapping ? (
          <div className="space-y-4">
            {/* Connexion active */}
            <div className="flex items-center justify-between p-6 bg-success/10 rounded-xl border border-success/20">
              <div className="flex items-center gap-4">
                <CheckCircle className="w-5 h-5 text-success" />
                <div>
                  <p className="font-semibold text-success">
                    {establishmentName ?? 'Établissement Pronote'}
                  </p>
                  <p className="text-sm text-success">
                    Élève: {childMapping.pronoteChildName}
                    {childMapping.pronoteClassName &&
                      ` (${childMapping.pronoteClassName})`}
                  </p>
                  {lastSync && (
                    <p className="text-xs text-success mt-1">
                      Synchronisé le{' '}
                      {new Date(lastSync).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onConnect}
                className="text-success border-success/20 hover:bg-success/5"
              >
                Gérer
              </Button>
            </div>

            {/* Actions rapides */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="flex-col h-auto p-6 border-primary/30 hover:bg-primary/10"
                onClick={() => onNavigate('grades')}
              >
                <BarChart3 className="w-4 h-4 mb-2 text-primary" />
                <span className="text-sm font-medium">Notes</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-auto p-6 border-primary/30 hover:bg-primary/10"
                onClick={() => onNavigate('timetable')}
              >
                <Calendar className="w-4 h-4 mb-2 text-primary" />
                <span className="text-sm font-medium">EDT</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-auto p-6 border-primary/30 hover:bg-primary/10"
                onClick={() => onNavigate('homework')}
              >
                <FileText className="w-4 h-4 mb-2 text-primary" />
                <span className="text-sm font-medium">Devoirs</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
              <XCircle className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-lg font-semibold mb-2 text-foreground">
              {parentConnected
                ? 'Enfant non mappé à Pronote'
                : 'Connexion Pronote requise'}
            </h4>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {parentConnected
                ? `Associez ${child.firstName} à un élève de votre compte Pronote pour synchroniser ses données.`
                : `Connectez votre compte Pronote parent pour synchroniser les notes, devoirs et emploi du temps de ${child.firstName}.`}
            </p>
            <Button onClick={onConnect}>
              {parentConnected ? 'Configurer le mapping' : 'Connecter Pronote'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ===== MAIN COMPONENT =====

export default function ChildView(): React.ReactElement {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const user = useUser();
  const queryClient = useQueryClient();

  // TanStack Query pour les données parent
  const { dashboardData, isLoading: parentLoading } = useParentDataQuery();
  const children = useMemo(
    () => dashboardData?.children ?? [],
    [dashboardData?.children]
  );

  // State local
  const [child, setChild] = useState<IChild | null>(null);
  const [showPronoteModal, setShowPronoteModal] = useState(false);

  // Hooks Pronote parent-based
  const {
    data: pronoteStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useParentPronoteStatus();

  const {
    data: childMappings = [],
    isLoading: mappingsLoading,
    refetch: refetchMappings,
  } = useChildMappings();

  // Trouver le mapping pour cet enfant spécifique
  const childMapping = useMemo(() => {
    if (!child?.id || !childMappings) return null;
    return childMappings.find((m) => m.childId === child.id) ?? null;
  }, [child?.id, childMappings]);

  // Effet pour identifier l'enfant courant
  useEffect(() => {
    if (!childId || !user) return;

    const foundChild = children.find(
      (c) => c.id === childId || c.username === childId
    );

    if (!foundChild && !parentLoading) {
      void navigate('/parent');
      return;
    }

    if (foundChild) {
      setChild(foundChild);
    }
  }, [childId, user, children, parentLoading, navigate]);

  // Handlers
  const handlePronoteConnect = () => {
    setShowPronoteModal(true);
  };

  const handlePronoteSuccess = () => {
    setShowPronoteModal(false);
    // Invalider toutes les queries Pronote pour recharger
    void queryClient.invalidateQueries({ queryKey: ['parentPronote'] });
  };

  const handleRefreshPronote = () => {
    void refetchStatus();
    void refetchMappings();
  };

  // Loading state
  const isLoading = parentLoading || statusLoading || mappingsLoading;

  if (!child || parentLoading) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/parent')}
            className="hover:bg-primary/10 text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Avatar className="w-14 h-14 ring-2 ring-background shadow-lg">
            <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground">
              <User className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {child.firstName} {child.lastName}
            </h1>
            <p className="text-muted-foreground mt-1">
              {child.schoolLevel} • @{child.username}
            </p>
          </div>
        </div>
      </div>

      {/* Section Pronote */}
      <PronoteSection
        child={child}
        childMapping={childMapping}
        parentConnected={pronoteStatus?.connected ?? false}
        establishmentName={pronoteStatus?.establishmentName}
        lastSync={pronoteStatus?.lastSync}
        onConnect={handlePronoteConnect}
        onRefresh={handleRefreshPronote}
        onNavigate={(path) => navigate(`/parent/children/${childId}/${path}`)}
        loading={isLoading}
      />

      {/* Modal Pronote */}
      {showPronoteModal && (
        <ConnectPronote
          isOpen={true}
          onClose={() => setShowPronoteModal(false)}
          onSuccess={handlePronoteSuccess}
          children={children}
          preselectedChild={child}
        />
      )}
    </PageContainer>
  );
}
