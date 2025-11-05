/**
 * SubjectsGrid - Grille de Matières Responsive
 *
 * Molecule composant plusieurs SubjectCards en grille adaptive.
 * Gère l'état vide RAG et le mode scolaire.
 */

import { type ReactElement } from 'react';
import { BookOpen } from 'lucide-react';
import { SubjectCard } from '@/components/dashboard/atoms/SubjectCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EducationSubject } from '@/types';

export interface SubjectsGridProps {
  subjects: EducationSubject[];
  onSubjectClick: (subject: string) => void;
  mode?: 'primary' | 'college' | 'lycee';
  isRAGEmpty?: boolean;
  onRefreshRAG?: (() => void) | undefined;
  className?: string | undefined;
}

export function SubjectsGrid({
  subjects,
  onSubjectClick,
  mode = 'lycee',
  isRAGEmpty = false,
  onRefreshRAG,
  className
}: SubjectsGridProps): ReactElement {
  // État vide RAG (database vectorielle non initialisée)
  if (isRAGEmpty) {
    return (
      <Card className={cn('border-warning/20 bg-warning/5', className)}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-warning/10 rounded-full flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-warning" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                {mode === 'primary'
                  ? '📚 On prépare tes matières...'
                  : 'Initialisation du système de connaissances'
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {mode === 'primary'
                  ? 'Ton espace de travail se prépare. Reviens dans quelques instants !'
                  : 'Le système RAG est en cours d\'initialisation. Cela peut prendre quelques secondes.'
                }
              </p>
            </div>
            {onRefreshRAG && (
              <Button
                variant="default"
                onClick={onRefreshRAG}
                className="min-h-[44px]"
              >
                {mode === 'primary' ? '🔄 Vérifier' : 'Actualiser'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grille normale de matières - Layout moderne et aéré
  return (
    <div
      className={cn(
        'grid gap-5 md:gap-6',
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
    >
      {subjects.map((subject) => (
        <SubjectCard
          key={subject.key}
          subject={subject}
          onClick={() => onSubjectClick(subject.name)}
          mode={mode}
        />
      ))}
    </div>
  );
}
