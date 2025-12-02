/**
 * LearningDeckNew - Génération IA de deck
 * Interface simple: matière + thème → génération automatique via RAG
 * Le niveau scolaire est automatiquement pris du profil utilisateur
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Sparkles, Loader2, BookOpen, AlertCircle, Lightbulb } from 'lucide-react';
import { useGenerateDeck } from '@/hooks/useLearning';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IGenerateDeckRequest } from '@/types';
import type { ApiError } from '@/lib/api-client';

// Matières disponibles
const SUBJECTS = [
  { value: 'mathematiques', label: 'Mathématiques' },
  { value: 'francais', label: 'Français' },
  { value: 'histoire_geo', label: 'Histoire-Géographie' },
  { value: 'sciences', label: 'Sciences' },
  { value: 'anglais', label: 'Anglais' },
  { value: 'physique_chimie', label: 'Physique-Chimie' },
  { value: 'svt', label: 'SVT' },
  { value: 'philosophie', label: 'Philosophie' },
];

export default function LearningDeckNew(): ReactElement {
  const navigate = useNavigate();
  const { generateDeck, isGenerating } = useGenerateDeck();

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<ApiError | null>(null);

  const isFormValid = subject && topic.trim().length >= 3;

  const handleGenerate = async () => {
    if (!isFormValid) return;

    setError(null);

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

      // Afficher l'erreur si c'est une erreur de validation (thème non trouvé)
      if (apiError.code === 'TOPIC_NOT_IN_CURRICULUM') {
        setError(apiError);
      }
      // Autres erreurs gérées par le hook (toast)
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
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
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

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Matière *</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une matière" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic">Thème / Chapitre *</Label>
              <Input
                id="topic"
                placeholder="Ex: Les fractions, La Révolution française, Le théorème de Pythagore..."
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setError(null); // Clear error on input change
                }}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Le thème doit correspondre au programme officiel de ton niveau
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

            {/* Info */}
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
