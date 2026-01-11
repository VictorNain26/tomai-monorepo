/**
 * ChildView - Vue détaillée d'un enfant pour les parents
 *
 * Affiche les informations basiques de l'enfant.
 * Note: Pronote sera disponible uniquement sur l'app mobile.
 */

import { useUser } from '../lib/auth';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, User } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import type { IChild } from '@/types';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';

export default function ChildView(): React.ReactElement {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const user = useUser();

  // TanStack Query pour les données parent
  const { dashboardData, isLoading: parentLoading } = useParentDataQuery();
  const children = useMemo(
    () => dashboardData?.children ?? [],
    [dashboardData?.children]
  );

  // State local
  const [child, setChild] = useState<IChild | null>(null);

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

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Les fonctionnalités avancées (Pronote, suivi des devoirs) seront
            disponibles prochainement sur l'application mobile.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
