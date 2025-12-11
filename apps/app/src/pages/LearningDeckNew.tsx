/**
 * LearningDeckNew - Génération IA de deck
 * Interface simple: matière + thème → génération automatique via RAG
 * Le niveau scolaire est automatiquement pris du profil utilisateur
 * Matières dynamiques depuis Qdrant (filtrées par niveau + LV2)
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  BookOpen,
  AlertCircle,
  Lightbulb,
  Lock,
  Crown,
} from 'lucide-react';
import { useGenerateDeck } from '@/hooks/useLearning';
import { useUser } from '@/lib/auth';
import { educationQueries, type ITopicsResponse } from '@/lib/query-factories';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  const { generateDeck, isGenerating } = useGenerateDeck();

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);

  // Récupérer le niveau et LV2 du profil utilisateur
  const schoolLevel = (user?.schoolLevel ?? 'sixieme') as EducationLevelType;
  const selectedLv2 = user?.selectedLv2 ?? null;

  // Fetch subjects dynamiquement depuis Qdrant (filtrés par niveau + LV2)
  const {
    data: subjectsData,
    isLoading: subjectsLoading,
    error: subjectsError,
  } = useQuery({
    ...educationQueries.subjectsForLevel(schoolLevel, selectedLv2),
    enabled: !!schoolLevel,
  });

  // Fetch topics pour la matière sélectionnée (depuis RAG)
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

  // Reset topic when subject changes
  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setTopic(''); // Reset topic when subject changes
    setError(null);
    setSubscriptionRequired(false);
  };

  const handleGenerate = async () => {
    if (!isFormValid) return;

    setError(null);
    setSubscriptionRequired(false);

    try {
      const request: IGenerateDeckRequest = {
        subject,
        topic: topic.trim(),
        cardCount: 8,
      };

      const result = await generateDeck(request);
      void navigate(`/student/learning/${result.deck.id}`);
    } catch (err) {
      const apiError = err as ApiError;

      // Erreur 403 - Abonnement requis
      if (apiError.status === 403 || apiError.code === 'SUBSCRIPTION_REQUIRED') {
        setSubscriptionRequired(true);
        return;
      }

      // Erreur de validation (thème non trouvé dans le programme)
      if (apiError.code === 'TOPIC_NOT_IN_CURRICULUM') {
        setError(apiError);
        return;
      }

      // Autres erreurs - afficher le message
      setError(apiError);
    }
  };

  return (
    <PageContainer>
      {/* Header */}
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
          L'IA génère des cartes de révision alignées sur le programme officiel de ton niveau
        </p>
      </div>

      <div className="max-w-xl mx-auto">
        {/* Alerte Abonnement Requis - Affichée en premier si nécessaire */}
        {subscriptionRequired && (
          <Card className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Crown className="h-5 w-5" />
                Fonctionnalité Premium
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-amber-800 dark:text-amber-200 font-medium">
                    La génération de cartes de révision par IA est réservée aux comptes Premium.
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    Demande à tes parents de souscrire un abonnement pour débloquer cette fonctionnalité
                    et créer des decks personnalisés alignés sur ton programme scolaire.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubscriptionRequired(false)}
                  className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  Compris
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/student/learning')}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Voir mes decks existants
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Génération automatique
            </CardTitle>
            <CardDescription>
              Choisis une matière et un thème, l'IA crée les flashcards, QCM et Vrai/Faux
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Alert - Thème non trouvé ou autre erreur */}
            {error && !subscriptionRequired && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{error.message}</p>
                    {error.suggestions && error.suggestions.length > 0 && (
                      <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4" />
                          <span className="font-medium text-sm">Suggestions</span>
                        </div>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {error.suggestions.map((suggestion) => (
                            <li key={suggestion}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Subject - Dynamique depuis Qdrant */}
            <div className="space-y-2">
              <Label htmlFor="subject">Matière *</Label>
              {subjectsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : subjectsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Impossible de charger les matières. Réessaie plus tard.
                  </AlertDescription>
                </Alert>
              ) : subjects.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucune matière disponible pour ton niveau ({schoolLevel}).
                    Le contenu pédagogique est en cours de préparation.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={subject} onValueChange={handleSubjectChange} disabled={isGenerating}>
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

            {/* Topic - Sélection guidée depuis RAG */}
            <div className="space-y-2">
              <Label htmlFor="topic">Thème / Chapitre *</Label>
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
                    Impossible de charger les thèmes. Réessaie plus tard.
                  </AlertDescription>
                </Alert>
              ) : domaines.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun thème disponible pour cette matière à ton niveau ({schoolLevel}).
                    Le contenu pédagogique est en cours de préparation.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={topic}
                  onValueChange={(value) => {
                    setTopic(value);
                    setError(null);
                    setSubscriptionRequired(false);
                  }}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un thème du programme" />
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
              <p className="text-xs text-muted-foreground">
                Thèmes du programme officiel de {schoolLevel}
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={() => void handleGenerate()}
              disabled={!isFormValid || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Générer le deck
                </>
              )}
            </Button>

            {/* Info during generation */}
            {isGenerating && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Génération en cours</p>
                  <p className="text-muted-foreground">
                    L'IA analyse le programme officiel et crée des cartes adaptées à ton niveau.
                    Cela peut prendre quelques secondes...
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
