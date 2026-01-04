/**
 * Student Timetable Page - Display student's own timetable from Pronote
 *
 * Student view to see their schedule (read-only).
 * Uses the useStudentTimetable hook with week navigation.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  MapPin,
  User,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer } from '@/components/shared/PageContainer';
import { useStudentTimetable, useStudentPronoteStatus } from '@/hooks/useStudentPronote';

export default function StudentTimetable() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);

  // Check connection status
  const { data: status, isLoading: statusLoading } = useStudentPronoteStatus();
  const isConnected = status?.connected ?? false;

  // Fetch timetable
  const { data: timetable, isLoading, error } = useStudentTimetable(weekOffset, isConnected);

  // Week label
  const getWeekLabel = () => {
    if (weekOffset === 0) return 'Cette semaine';
    if (weekOffset === 1) return 'Semaine prochaine';
    if (weekOffset === -1) return 'Semaine dernière';
    const date = new Date();
    date.setDate(date.getDate() + weekOffset * 7);
    return `Semaine du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  };

  // Group by day
  const groupedByDay = timetable?.reduce(
    (acc, entry) => {
      const date = new Date(entry.startTime);
      const dayKey = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(entry);
      return acc;
    },
    {} as Record<string, typeof timetable>
  );

  // Sort entries by time
  if (groupedByDay) {
    Object.values(groupedByDay).forEach((entries) =>
      entries?.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">Mon emploi du temps</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" />
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
          <h1 className="text-2xl font-bold text-foreground">Mon emploi du temps</h1>
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
            <p className="text-destructive">
              Erreur: Impossible de charger l'emploi du temps
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Vérifiez que la connexion Pronote est active.
            </p>
          </CardContent>
        </Card>
      ) : groupedByDay && Object.keys(groupedByDay).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedByDay).map(([day, entries]) => (
            <div key={day}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {day}
              </h3>
              <div className="space-y-2">
                {entries?.map((entry) => {
                  const isCancelled = entry.status === 'cancelled';
                  const isModified = entry.status === 'modified';

                  return (
                    <Card
                      key={entry.id}
                      className={`${
                        isCancelled
                          ? 'opacity-60 bg-muted/50'
                          : isModified
                            ? 'border-warning/50 bg-warning/5'
                            : ''
                      }`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-start gap-4">
                          {/* Time */}
                          <div className="text-center min-w-[60px]">
                            <p className="text-sm font-semibold text-primary">
                              {new Date(entry.startTime).toLocaleTimeString(
                                'fr-FR',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.endTime).toLocaleTimeString(
                                'fr-FR',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </p>
                          </div>

                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-medium ${
                                  isCancelled ? 'line-through' : ''
                                }`}
                              >
                                {entry.subject}
                              </p>
                              {isCancelled && (
                                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                                  Annulé
                                </span>
                              )}
                              {isModified && (
                                <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Modifié
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                              {entry.teacher && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {entry.teacher}
                                </span>
                              )}
                              {entry.room && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {entry.room}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {Math.round(
                                  (new Date(entry.endTime).getTime() -
                                    new Date(entry.startTime).getTime()) /
                                    60000
                                )}{' '}
                                min
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Aucun cours cette semaine
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
