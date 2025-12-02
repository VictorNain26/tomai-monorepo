/**
 * LearningDeckNew - Génération IA de deck
 * Interface simple: matière + thème → génération automatique via RAG
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { useGenerateDeck } from '@/hooks/useLearning';
import { useUser } from '@/lib/auth';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import type { EducationLevelType, IGenerateDeckRequest } from '@/types';

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

// Niveaux scolaires
const SCHOOL_LEVELS: { value: EducationLevelType; label: string }[] = [
  { value: 'cp', label: 'CP' },
  { value: 'ce1', label: 'CE1' },
  { value: 'ce2', label: 'CE2' },
  { value: 'cm1', label: 'CM1' },
  { value: 'cm2', label: 'CM2' },
  { value: 'sixieme', label: '6ème' },
  { value: 'cinquieme', label: '5ème' },
  { value: 'quatrieme', label: '4ème' },
  { value: 'troisieme', label: '3ème' },
  { value: 'seconde', label: '2nde' },
  { value: 'premiere', label: '1ère' },
  { value: 'terminale', label: 'Terminale' },
];

export default function LearningDeckNew(): ReactElement {
  const navigate = useNavigate();
  const user = useUser();
  const { generateDeck, isGenerating } = useGenerateDeck();

  // Form state
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<EducationLevelType | ''>(
    (user?.schoolLevel as EducationLevelType) || ''
  );

  const isFormValid = subject && topic.trim().length >= 3;

  const handleGenerate = async () => {
    if (!isFormValid) return;

    try {
      const request: IGenerateDeckRequest = {
        subject,
        topic: topic.trim(),
        cardCount: 8,
      };
      if (schoolLevel) {
        request.schoolLevel = schoolLevel;
      }
      const result = await generateDeck(request);

      // Navigate to the generated deck
      void navigate(`/student/learning/${result.deck.id}`);
    } catch {
      // Error handled by hook (toast)
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
          L'IA génère des cartes de révision alignées sur le programme officiel
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
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Sois précis pour obtenir des cartes pertinentes
              </p>
            </div>

            {/* School Level (optional override) */}
            <div className="space-y-2">
              <Label htmlFor="level">Niveau scolaire</Label>
              <Select
                value={schoolLevel}
                onValueChange={(v) => setSchoolLevel(v as EducationLevelType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ton niveau (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Laisse vide pour utiliser ton niveau de profil
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
