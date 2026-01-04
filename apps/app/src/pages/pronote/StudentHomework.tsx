/**
 * Student Homework Page - Display student's own homework from Pronote
 *
 * Student view to see their homework assignments (read-only).
 * Uses the useStudentHomework hook with week navigation.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, FileText, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/shared/PageContainer';
import { useStudentHomework, useStudentPronoteStatus } from '@/hooks/useStudentPronote';

export default function StudentHomework() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);

  // Check connection status
  const { data: status, isLoading: statusLoading } = useStudentPronoteStatus();
  const isConnected = status?.connected ?? false;

  // Fetch homework
  const { data: homework, isLoading, error } = useStudentHomework(weekOffset, isConnected);

  // Week label
  const getWeekLabel = () => {
    if (weekOffset === 0) return 'Cette semaine';
    if (weekOffset === 1) return 'Semaine prochaine';
    if (weekOffset === -1) return 'Semaine dernière';
    const date = new Date();
    date.setDate(date.getDate() + weekOffset * 7);
    return `Semaine du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  };

  // Not connected state
  if (!statusLoading && !isConnected) {
    return (
      <PageContainer>
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/student')}
            className="hover:bg-primary/10 text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Mes devoirs</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Pronote non connecté</h3>
            <p className="text-sm text-muted-foreground">
              Demande à tes parents de connecter Pronote depuis leur tableau de bord.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/student')}
          className="hover:bg-primary/10 text-primary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes devoirs</h1>
          <p className="text-muted-foreground text-sm">
            Données Pronote • {getWeekLabel()}
          </p>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédente
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(0)}
          disabled={weekOffset === 0}
        >
          Aujourd'hui
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="gap-2"
        >
          Suivante
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      {isLoading || statusLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Erreur: Impossible de charger les devoirs</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vérifiez que la connexion Pronote est active.
            </p>
          </CardContent>
        </Card>
      ) : homework && homework.length > 0 ? (
        <div className="space-y-3">
          {homework.map((hw) => (
            <Card key={hw.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {hw.subject}
                  </CardTitle>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      hw.done
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {hw.done ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Fait
                      </span>
                    ) : (
                      'À faire'
                    )}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{hw.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Pour le {new Date(hw.dueDate).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Aucun devoir cette semaine
            </h3>
            <p className="text-sm text-muted-foreground">
              Utilise les flèches pour naviguer entre les semaines.
            </p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
