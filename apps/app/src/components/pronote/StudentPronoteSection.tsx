/**
 * StudentPronoteSection - Display Pronote data for students
 *
 * Read-only view of homework, grades (summary) for connected students.
 * Connection is managed by parents for minor students.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  School,
  FileText,
  BarChart3,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useStudentPronoteStatus,
  useStudentHomework,
  useStudentGrades,
} from '@/hooks/useStudentPronote';

interface StudentPronoteSectionProps {
  className?: string;
}

export function StudentPronoteSection({ className }: StudentPronoteSectionProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Fetch status first
  const { data: status, isLoading: statusLoading } = useStudentPronoteStatus();

  // Only fetch data if connected
  const isConnected = status?.connected ?? false;
  const { data: homework, isLoading: homeworkLoading } = useStudentHomework(0, isConnected);
  const { data: grades } = useStudentGrades(isConnected);

  // Loading state
  if (statusLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <School className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-base">Pronote</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Non connecté</p>
              <p className="text-xs text-muted-foreground mt-1">
                Demande à tes parents de connecter Pronote depuis leur tableau de bord.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const upcomingHomework = homework?.filter((h) => !h.done).length ?? 0;
  const averageGrade =
    grades && grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.value / g.outOf) * 20, 0) / grades.length
      : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <School className="w-4 h-4 text-success" />
            </div>
            <div>
              <CardTitle className="text-base">Pronote</CardTitle>
              {status?.establishmentName && (
                <p className="text-xs text-muted-foreground">{status.establishmentName}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? 'Réduire' : 'Voir plus'}
            <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {/* Homework */}
          <button
            onClick={() => navigate('/student/pronote/homework')}
            className="p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left"
          >
            <FileText className="w-4 h-4 text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">{upcomingHomework}</p>
            <p className="text-xs text-muted-foreground">Devoirs</p>
          </button>

          {/* Average */}
          <button
            onClick={() => navigate('/student/pronote/grades')}
            className="p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left"
          >
            <BarChart3 className="w-4 h-4 text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">
              {averageGrade !== null ? averageGrade.toFixed(1) : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Moyenne</p>
          </button>

          {/* Timetable */}
          <button
            onClick={() => navigate('/student/pronote/timetable')}
            className="p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left"
          >
            <Calendar className="w-4 h-4 text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">EDT</p>
            <p className="text-xs text-muted-foreground">Emploi</p>
          </button>
        </div>

        {/* Expanded: Show homework list */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium text-foreground">Prochains devoirs</h4>
            {homeworkLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : homework && homework.length > 0 ? (
              <div className="space-y-2">
                {homework.slice(0, 3).map((hw) => (
                  <div
                    key={hw.id}
                    className={`p-3 rounded-lg border ${
                      hw.done ? 'bg-muted/30 opacity-60' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{hw.subject}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          hw.done ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {hw.done ? 'Fait' : 'À faire'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {hw.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pour le {new Date(hw.dueDate).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                ))}
                {homework.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/student/pronote/homework')}
                    className="w-full text-xs"
                  >
                    Voir tous les devoirs ({homework.length})
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">Aucun devoir cette semaine</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StudentPronoteSection;
