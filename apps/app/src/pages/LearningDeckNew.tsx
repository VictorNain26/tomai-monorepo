/**
 * LearningDeckNew - Génération IA de deck
 * Interface simple: matière + thème → génération automatique via RAG
 * L'IA génère des cartes exhaustives couvrant tout le thème
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
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

export default function LearningDeckNew(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const { generateDeck } = useGenerateDeck();

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');

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
  const domaines = (topicsData as ITopicsResponse | undefined)?.domaines ?? [];
  const isFormValid = subject && topic.length > 0;
  const isLoadingTopics = !!subject && topicsLoading;

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setTopic('');
  };

  const handleGenerate = () => {
    if (!isFormValid) return;

    const request: IGenerateDeckRequest = {
      subject,
      topic: topic.trim(),
      cardCount: 10,
    };

    toast.loading('Génération du deck en cours...', {
      id: 'deck-generation',
      description: 'Tu seras notifié quand ce sera prêt.',
    });

    void navigate('/student/learning');

    generateDeck(request)
      .then((result) => {
        toast.success('Deck créé avec succès !', {
          id: 'deck-generation',
          description: `${result.deck.cardCount} cartes sur "${topic}"`,
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
              Choisis une matière et un thème, l'IA crée les cartes de révision
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Matière */}
            <div className="space-y-2">
              <Label>Matière *</Label>
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

            {/* Thème */}
            <div className="space-y-2">
              <Label>Thème *</Label>
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
                    Impossible de charger les thèmes.
                  </AlertDescription>
                </Alert>
              ) : domaines.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun thème disponible pour cette matière.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un thème" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {domaines.map((domaine) => (
                      <SelectGroup key={domaine.domaine}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {domaine.domaine}
                        </SelectLabel>
                        {domaine.themes.map((theme) => (
                          <SelectItem key={`${domaine.domaine}-${theme}`} value={theme}>
                            {theme}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!isFormValid || isLoadingTopics}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Générer le deck
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
