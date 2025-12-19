/**
 * LearningDeckNew - Génération IA de deck
 *
 * Interface en 3 étapes : matière → domaine → (optionnel) sous-chapitre
 * Permet de réviser soit un domaine complet, soit un sous-chapitre spécifique
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IGenerateDeckRequest, EducationLevelType } from '@/types';
import type { ApiError } from '@/lib/api-client';

/** Valeur spéciale pour indiquer "tout le domaine" */
const FULL_DOMAINE_VALUE = '__FULL_DOMAINE__';

export default function LearningDeckNew(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const { generateDeck } = useGenerateDeck();

  const [subject, setSubject] = useState('');
  const [selectedDomaine, setSelectedDomaine] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

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

  // Memoize domaines pour éviter re-renders inutiles
  const domaines = useMemo(
    () => (topicsData as ITopicsResponse | undefined)?.domaines ?? [],
    [topicsData]
  );

  // Thèmes disponibles pour le domaine sélectionné
  const availableThemes = useMemo(() => {
    if (!selectedDomaine) return [];
    const domaine = domaines.find(d => d.domaine === selectedDomaine);
    return domaine?.themes ?? [];
  }, [domaines, selectedDomaine]);

  // Mode de génération
  const isFullDomaineMode = selectedTopic === FULL_DOMAINE_VALUE || selectedTopic === '';

  // Validation: matière + domaine requis
  const isFormValid = subject.length > 0 && selectedDomaine.length > 0;
  const isLoadingTopics = !!subject && topicsLoading;

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setSelectedDomaine('');
    setSelectedTopic('');
  };

  const handleDomaineChange = (newDomaine: string) => {
    setSelectedDomaine(newDomaine);
    setSelectedTopic(''); // Reset topic, utilisateur peut choisir ou laisser vide
  };

  const handleTopicChange = (newTopic: string) => {
    setSelectedTopic(newTopic);
  };

  const handleGenerate = () => {
    if (!isFormValid) return;

    const request: IGenerateDeckRequest = {
      subject,
      domaine: selectedDomaine,
      // topic optionnel: undefined si mode domaine complet
      topic: isFullDomaineMode ? undefined : selectedTopic.trim(),
    };

    const displayName = isFullDomaineMode
      ? `tout le domaine "${selectedDomaine}"`
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
              Choisis ce que tu veux réviser : un domaine complet ou un sous-chapitre
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

            {/* 2. Domaine */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Domaine
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
                    Impossible de charger les domaines.
                  </AlertDescription>
                </Alert>
              ) : domaines.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun domaine disponible pour cette matière.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedDomaine} onValueChange={handleDomaineChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    {domaines.map((d) => (
                      <SelectItem key={d.domaine} value={d.domaine}>
                        {d.domaine}
                        <span className="text-muted-foreground ml-2">
                          ({d.themes.length} thèmes)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 3. Sous-chapitre (optionnel) */}
            {selectedDomaine && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Sous-chapitre (optionnel)
                </Label>
                <Select value={selectedTopic} onValueChange={handleTopicChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tout le domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FULL_DOMAINE_VALUE}>
                      <span className="flex items-center gap-2 font-medium">
                        <Layers className="h-4 w-4" />
                        Tout le domaine
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
                  {isFullDomaineMode
                    ? `Révise l'ensemble du domaine "${selectedDomaine}" (plus de cartes)`
                    : `Révise uniquement "${selectedTopic}"`}
                </p>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!isFormValid || isLoadingTopics}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isFullDomaineMode && selectedDomaine
                ? `Générer sur tout "${selectedDomaine}"`
                : 'Générer le deck'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
