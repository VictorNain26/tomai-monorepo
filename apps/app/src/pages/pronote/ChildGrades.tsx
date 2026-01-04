/**
 * Child Grades Page - Display child's grades from Pronote
 *
 * Parent view to see their child's grades.
 * Uses the useChildGrades hook.
 */

import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, BarChart3, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { useChildGrades } from '@/hooks/useParentPronote';
import { useParentDataQuery } from '@/hooks/useParentDataQuery';

export default function ChildGrades() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();

  // Get child info
  const { dashboardData } = useParentDataQuery();
  const child = dashboardData?.children?.find((c) => c.id === childId);

  // Fetch grades
  const { data: grades, isLoading, error } = useChildGrades(childId);

  // Calculate average
  const average =
    grades && grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.value / g.outOf) * 20 * g.coefficient, 0) /
        grades.reduce((sum, g) => sum + g.coefficient, 0)
      : null;

  if (!child) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
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
          onClick={() => navigate(`/parent/children/${childId}`)}
          className="hover:bg-primary/10 text-primary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Notes de {child.firstName}
          </h1>
          <p className="text-muted-foreground text-sm">
            Données Pronote • Période en cours
          </p>
        </div>
      </div>

      {/* Average Card */}
      {average !== null && (
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Moyenne générale</p>
                <p className="text-3xl font-bold text-primary">
                  {average.toFixed(2)}/20
                </p>
              </div>
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                {average >= 10 ? (
                  <TrendingUp className="w-7 h-7 text-success" />
                ) : (
                  <TrendingDown className="w-7 h-7 text-destructive" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Erreur: Impossible de charger les notes</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vérifiez que la connexion Pronote est active.
            </p>
          </CardContent>
        </Card>
      ) : grades && grades.length > 0 ? (
        <div className="space-y-3">
          {grades.map((grade) => {
            const normalized = (grade.value / grade.outOf) * 20;
            const isGood = normalized >= 10;

            return (
              <Card key={grade.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">
                      {grade.subject}
                    </CardTitle>
                    <span
                      className={`text-lg font-bold ${
                        isGood ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {grade.value}/{grade.outOf}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">
                      {grade.description && (
                        <p className="mb-1">{grade.description}</p>
                      )}
                      <p className="text-xs">
                        Coeff. {grade.coefficient} •{' '}
                        {new Date(grade.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {normalized.toFixed(1)}/20
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Aucune note cette période
            </h3>
            <p className="text-sm text-muted-foreground">
              Les notes apparaîtront ici dès qu'elles seront disponibles.
            </p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
