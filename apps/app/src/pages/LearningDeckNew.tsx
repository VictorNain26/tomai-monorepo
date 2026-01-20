/**
 * LearningDeckNew - Génération IA de deck
 *
 * Interface en 4 étapes : matière → chapitre → sous-chapitre → (optionnel) thème
 * Permet de réviser soit un sous-chapitre complet, soit un thème spécifique
 *
 * Hiérarchie RAG (2026):
 * - matiere: histoire_geo, francais, mathematiques...
 * - chapter (domaine): "Nombres et Calculs", "Géométrie"...
 * - subChapter (sousdomaine): "Fractions", "Échelles"...
 * - topic (title): "Addition de fractions", "Lecture d'échelle"...
 *
 * Architecture 2026: Pas de useMemo - React Compiler optimise automatiquement
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, AlertCircle, BookOpen, Layers } from 'lucide-react';
import { useGenerateDeck } from '@/hooks/useLearning';
import { useUser } from '@/lib/auth';
import { educationQueries } from '@/lib/query-factories';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IGenerateDeckRequest, EducationLevelType, ChaptersHierarchy } from '@/types';
import type { ApiError } from '@/lib/api-client';

/** Valeur spéciale pour indiquer "tout le sous-chapitre" */
const FULL_SUBCHAPTER_VALUE = '__FULL_SUBCHAPTER__';

export default function LearningDeckNew(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const { generateDeck, isGenerating } = useGenerateDeck();

  // État du formulaire
  const [subject, setSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedSubChapter, setSelectedSubChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  // Données utilisateur
  const schoolLevel = (user?.schoolLevel ?? 'sixieme') as EducationLevelType;
  const selectedLv2 = user?.selectedLv2 ?? null;

  // Queries TanStack
  const {
    data: subjectsData,
    isLoading: subjectsLoading,
    error: subjectsError,
  } = useQuery({
    ...educationQueries.subjectsForLevel(schoolLevel, selectedLv2),
    enabled: !!schoolLevel,
  });

  const {
    data: chaptersData,
    isLoading: chaptersLoading,
    error: chaptersError,
  } = useQuery({
    ...educationQueries.chaptersForSubject(schoolLevel, subject),
    enabled: !!schoolLevel && !!subject,
  });

  // Données dérivées (React Compiler optimise automatiquement)
  const subjects = subjectsData?.subjects ?? [];
  const chapters = (chaptersData as ChaptersHierarchy | undefined)?.chapters ?? [];
  const currentChapter = chapters.find((c) => c.name === selectedChapter);
  const subChapters = currentChapter?.subChapters ?? [];
  const currentSubChapter = subChapters.find((sc) => sc.name === selectedSubChapter);
  const availableTopics = currentSubChapter?.topics ?? [];

  // États dérivés
  const isFullSubChapterMode = selectedTopic === FULL_SUBCHAPTER_VALUE || selectedTopic === '';
  const isFormValid = subject !== '' && selectedChapter !== '' && selectedSubChapter !== '';
  const isLoadingChapters = subject !== '' && chaptersLoading;

  // Handlers avec reset en cascade
  const handleSubjectChange = (value: string) => {
    setSubject(value);
    setSelectedChapter('');
    setSelectedSubChapter('');
    setSelectedTopic('');
  };

  const handleChapterChange = (value: string) => {
    setSelectedChapter(value);
    setSelectedSubChapter('');
    setSelectedTopic('');
  };

  const handleSubChapterChange = (value: string) => {
    setSelectedSubChapter(value);
    setSelectedTopic('');
  };

  const handleGenerate = () => {
    if (!isFormValid) return;

    const request: IGenerateDeckRequest = {
      subject,
      domaine: selectedSubChapter,
      topic: isFullSubChapterMode ? undefined : selectedTopic.trim(),
    };

    const displayName = isFullSubChapterMode
      ? `tout "${selectedSubChapter}"`
      : `"${selectedTopic}"`;

    toast.loading('Génération du deck en cours...', {
      id: 'deck-generation',
      description: `Création de cartes sur ${displayName}`,
    });

    void navigate('/student/learning');

    generateDeck(request)
      .then((result) => {
        toast.success('Deck créé avec succès !', {
          id: 'deck-generation',
          description: `${result.deck.cardCount} cartes générées`,
          action: {
            label: 'Voir',
            onClick: () => void navigate(`/student/learning/${result.deck.id}`),
          },
        });
      })
      .catch((err: unknown) => {
        const apiError = err as ApiError;

        if (apiError.status === 403 || apiError.code === 'SUBSCRIPTION_REQUIRED') {
          toast.error('Abonnement requis', {
            id: 'deck-generation',
            description: 'Demande à tes parents de souscrire un abonnement Premium.',
          });
          return;
        }

        if (apiError.status === 429 || apiError.code === 'DECK_LIMIT_REACHED') {
          toast.error('Limite journalière atteinte', {
            id: 'deck-generation',
            description: 'Tu as atteint ta limite de decks par jour. Reviens demain !',
          });
          return;
        }

        toast.error('Erreur de génération', {
          id: 'deck-generation',
          description: apiError.message ?? 'Une erreur est survenue.',
        });
      });
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/student/learning')}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Créer un deck</h1>
        <p className="text-muted-foreground mt-1">
          L'IA génère des cartes alignées sur le programme officiel
        </p>
      </div>

      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Génération automatique
            </CardTitle>
            <CardDescription>
              Choisis ce que tu veux réviser : un sous-chapitre complet ou un thème spécifique
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 1. Matière */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Matière
              </Label>
              {subjectsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : subjectsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Impossible de charger les matières.</AlertDescription>
                </Alert>
              ) : subjects.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Aucune matière disponible pour ton niveau.</AlertDescription>
                </Alert>
              ) : (
                <Select value={subject} onValueChange={handleSubjectChange} disabled={isLoadingChapters}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une matière" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        <span className="flex items-center gap-2">
                          <span>{s.emoji}</span>
                          <span>{s.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 2. Chapitre (domaine) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Chapitre
              </Label>
              {subject === '' ? (
                <Select disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisis d'abord une matière" />
                  </SelectTrigger>
                </Select>
              ) : chaptersLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : chaptersError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Impossible de charger les chapitres.</AlertDescription>
                </Alert>
              ) : chapters.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Aucun chapitre disponible pour cette matière.</AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedChapter} onValueChange={handleChapterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un chapitre" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapters.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.name}>
                        {chapter.name}
                        <span className="text-muted-foreground ml-2">
                          ({chapter.subChaptersCount} sous-chapitres)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 3. Sous-chapitre (sousdomaine) */}
            {selectedChapter !== '' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Sous-chapitre
                </Label>
                {subChapters.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Aucun sous-chapitre disponible.</AlertDescription>
                  </Alert>
                ) : (
                  <Select value={selectedSubChapter} onValueChange={handleSubChapterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un sous-chapitre" />
                    </SelectTrigger>
                    <SelectContent>
                      {subChapters.map((sc) => (
                        <SelectItem key={sc.id} value={sc.name}>
                          {sc.name}
                          <span className="text-muted-foreground ml-2">({sc.topicsCount} thèmes)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* 4. Thème (optionnel) */}
            {selectedSubChapter !== '' && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Thème (optionnel)</Label>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tout le sous-chapitre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FULL_SUBCHAPTER_VALUE}>
                      <span className="flex items-center gap-2 font-medium">
                        <Layers className="h-4 w-4" />
                        Tout le sous-chapitre
                      </span>
                    </SelectItem>
                    {availableTopics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isFullSubChapterMode
                    ? `Révise l'ensemble de "${selectedSubChapter}" (plus de cartes)`
                    : `Révise uniquement "${selectedTopic}"`}
                </p>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!isFormValid || isLoadingChapters || isGenerating}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isFullSubChapterMode && selectedSubChapter !== ''
                ? `Générer sur tout "${selectedSubChapter}"`
                : 'Générer le deck'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
