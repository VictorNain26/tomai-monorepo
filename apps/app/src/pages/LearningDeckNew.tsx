/**
 * LearningDeckNew - Génération IA de deck
 *
 * Interface en 3 étapes : matière → chapitre → (optionnel) thème
 * Permet de réviser soit un chapitre complet, soit un thème spécifique
 *
 * Hiérarchie RAG:
 * - matiere: histoire_geo, francais, mathematiques...
 * - sousdomaine → "Chapitre" affiché (ex: "Chrétientés et Islam", "La phrase")
 * - title → "Thème" affiché (ex: "L'Empire byzantin", "Types de phrases")
 */

import { type ReactElement, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, AlertCircle, BookOpen, Layers } from 'lucide-react';
import { useGenerateDeck } from '@/hooks/useLearning';
import { useUser } from '@/lib/auth';
import { educationQueries, type ITopicsResponse } from '@/lib/query-factories';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IGenerateDeckRequest, EducationLevelType } from '@/types';
import type { ApiError } from '@/lib/api-client';

/** Valeur spéciale pour indiquer "tout le chapitre" */
const FULL_CHAPITRE_VALUE = '__FULL_CHAPITRE__';

export default function LearningDeckNew(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const { generateDeck, isGenerating } = useGenerateDeck();

  const [subject, setSubject] = useState('');
  const [selectedChapitre, setSelectedChapitre] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');

  const schoolLevel = (user?.schoolLevel ?? 'sixieme') as EducationLevelType;
  const selectedLv2 = user?.selectedLv2 ?? null;

  const {
    data: subjectsData,
    isLoading: subjectsLoading,
    error: subjectsError,
  } = useQuery({
    ...educationQueries.subjectsForLevel(schoolLevel, selectedLv2),
    enabled: !!schoolLevel,
  });

  const {
    data: topicsData,
    isLoading: topicsLoading,
    error: topicsError,
  } = useQuery({
    ...educationQueries.topicsForSubject(schoolLevel, subject),
    enabled: !!schoolLevel && !!subject,
  });

  const subjects = subjectsData?.subjects ?? [];

  // Memoize chapitres (sousdomaine RAG) pour éviter re-renders inutiles
  const chapitres = useMemo(
    () => (topicsData as ITopicsResponse | undefined)?.domaines ?? [],
    [topicsData]
  );

  // Grouper les chapitres par catégorie (Histoire, Géographie, Grammaire, etc.)
  const chapitresByCategory = useMemo(() => {
    const grouped = new Map<string, typeof chapitres>();
    for (const chapitre of chapitres) {
      const category = chapitre.category ?? 'Autre';
      const existing = grouped.get(category) ?? [];
      existing.push(chapitre);
      grouped.set(category, existing);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [chapitres]);

  // Thèmes (titles RAG) disponibles pour le chapitre sélectionné
  const availableThemes = useMemo(() => {
    if (!selectedChapitre) return [];
    const chapitre = chapitres.find(c => c.domaine === selectedChapitre);
    return chapitre?.themes ?? [];
  }, [chapitres, selectedChapitre]);

  // Mode de génération: chapitre complet ou thème spécifique
  const isFullChapitreMode = selectedTheme === FULL_CHAPITRE_VALUE || selectedTheme === '';

  // Validation: matière + chapitre requis
  const isFormValid = subject.length > 0 && selectedChapitre.length > 0;
  const isLoadingTopics = !!subject && topicsLoading;

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setSelectedChapitre('');
    setSelectedTheme('');
  };

  const handleChapitreChange = (newChapitre: string) => {
    setSelectedChapitre(newChapitre);
    setSelectedTheme(''); // Reset thème, utilisateur peut choisir ou laisser vide
  };

  const handleThemeChange = (newTheme: string) => {
    setSelectedTheme(newTheme);
  };

  const handleGenerate = () => {
    if (!isFormValid) return;

    const request: IGenerateDeckRequest = {
      subject,
      domaine: selectedChapitre, // Le "domaine" API = chapitre (sousdomaine RAG)
      // topic optionnel: undefined si mode chapitre complet
      topic: isFullChapitreMode ? undefined : selectedTheme.trim(),
    };

    const displayName = isFullChapitreMode
      ? `tout le chapitre "${selectedChapitre}"`
      : `"${selectedTheme}"`;

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
              Choisis ce que tu veux réviser : un chapitre complet ou un thème spécifique
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
                  <AlertDescription>
                    Impossible de charger les matières.
                  </AlertDescription>
                </Alert>
              ) : subjects.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucune matière disponible pour ton niveau.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={subject} onValueChange={handleSubjectChange} disabled={isLoadingTopics}>
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

            {/* 2. Chapitre */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Chapitre
              </Label>
              {!subject ? (
                <Select disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisis d'abord une matière" />
                  </SelectTrigger>
                </Select>
              ) : topicsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : topicsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Impossible de charger les chapitres.
                  </AlertDescription>
                </Alert>
              ) : chapitres.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun chapitre disponible pour cette matière.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedChapitre} onValueChange={handleChapitreChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un chapitre" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapitresByCategory.map(([category, categoryChapitres]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="font-semibold text-foreground">
                          {category}
                        </SelectLabel>
                        {categoryChapitres.map((c) => (
                          <SelectItem key={c.domaine} value={c.domaine}>
                            {c.domaine}
                            <span className="text-muted-foreground ml-2">
                              ({c.themes.length} thèmes)
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 3. Thème (optionnel) */}
            {selectedChapitre && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Thème (optionnel)
                </Label>
                <Select value={selectedTheme} onValueChange={handleThemeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tout le chapitre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FULL_CHAPITRE_VALUE}>
                      <span className="flex items-center gap-2 font-medium">
                        <Layers className="h-4 w-4" />
                        Tout le chapitre
                      </span>
                    </SelectItem>
                    {availableThemes.map((theme) => (
                      <SelectItem key={theme} value={theme}>
                        {theme}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isFullChapitreMode
                    ? `Révise l'ensemble du chapitre "${selectedChapitre}" (plus de cartes)`
                    : `Révise uniquement "${selectedTheme}"`}
                </p>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!isFormValid || isLoadingTopics || isGenerating}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isFullChapitreMode && selectedChapitre
                ? `Générer sur tout "${selectedChapitre}"`
                : 'Générer le deck'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
