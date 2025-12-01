/**
 * ChildSubjectSelector - Version refactorisée Tom 2025
 * ✅ Respecte standards shadcn/ui + Tom CLAUDE.md
 * ✅ UX optimisée mobile/desktop avec lisibilité améliorée
 * ✅ TypeScript strict + ESLint zero warnings
 * ✅ Better Auth + TanStack Query patterns
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Check, BookOpen } from 'lucide-react';
import { useEducationLevel } from '@/hooks/useEducation';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import type { EducationLevelType, EducationSubject } from '@/types';

interface ChildSubjectSelectorProps {
  schoolLevel: EducationLevelType;
  initialSelectedKeys?: string[];
  onSelectionChange: (selectedKeys: string[]) => void;
  className?: string;
}

const ChildSubjectSelector: React.FC<ChildSubjectSelectorProps> = ({
  schoolLevel,
  initialSelectedKeys = [],
  onSelectionChange,
  className = ''
}) => {
  const { data: levelConfig, isLoading, error } = useEducationLevel(schoolLevel);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(initialSelectedKeys);

  // Synchroniser avec les sélections initiales
  useEffect(() => {
    setSelectedKeys(initialSelectedKeys);
  }, [initialSelectedKeys]);

  // Notifier les changements de sélection
  useEffect(() => {
    onSelectionChange(selectedKeys);
  }, [selectedKeys, onSelectionChange]);

  // Calculer les matières disponibles
  const availableSubjects = useMemo(() => {
    if (!levelConfig) return [];
    return levelConfig.subjects ?? [];
  }, [levelConfig]);

  const handleSubjectToggle = (subjectKey: string) => {
    setSelectedKeys(prev =>
      prev.includes(subjectKey)
        ? prev.filter(key => key !== subjectKey)
        : [...prev, subjectKey]
    );
  };

  const SubjectButton: React.FC<{ subject: EducationSubject; isSelected: boolean }> = ({
    subject,
    isSelected
  }) => (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="lg"
      className={cn(
        "h-auto p-4 flex items-center justify-start gap-3 text-left transition-all",
        isSelected && "ring-2 ring-primary/20"
      )}
      onClick={() => handleSubjectToggle(subject.key)}
    >
      <span className="text-2xl flex-shrink-0">{subject.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base leading-tight">{subject.name}</div>
        <div className={cn(
          "text-sm mt-1 leading-tight",
          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
        )}>
          {subject.description}
        </div>
      </div>
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
        isSelected
          ? "border-primary-foreground bg-primary-foreground"
          : "border-muted-foreground/30"
      )}>
        {isSelected && <Check className="h-3 w-3 text-primary" />}
      </div>
    </Button>
  );

  // État de chargement
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-center p-8">
          <BookOpen className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    );
  }

  // État d'erreur
  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="text-center p-4 text-destructive text-sm">
          Erreur lors du chargement: {error.message}
        </div>
      </div>
    );
  }

  // Aucune donnée
  if (!levelConfig) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="text-center p-4 text-muted-foreground text-sm">
          Aucune configuration pour ce niveau
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Toutes les matières disponibles */}
      {availableSubjects.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Matières disponibles
            <Badge variant="outline" className="ml-2">
              {selectedKeys.length}/{availableSubjects.length} sélectionnées
            </Badge>
          </Label>
          <div className="grid gap-3">
            {availableSubjects.map((subject) => (
              <SubjectButton
                key={subject.key}
                subject={subject}
                isSelected={selectedKeys.includes(subject.key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Aucune matière disponible */}
      {availableSubjects.length === 0 && (
        <div className="text-center p-4 text-muted-foreground text-sm">
          Aucune matière disponible pour ce niveau
        </div>
      )}
    </div>
  );
};

export { ChildSubjectSelector };
export default ChildSubjectSelector;
