/**
 * LearningDeck - Page de révision d'un deck
 * Affiche les cartes une par une, pas de score visible
 * Supporte 13 types de cartes différents selon la matière
 */

import { type ReactElement, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Layers, Shuffle } from 'lucide-react';
import { useDeck } from '@/hooks/useLearning';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { CardViewer } from '@/components/learning/CardViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp as T;
  }
  return shuffled;
}

export default function LearningDeck(): ReactElement {
  const navigate = useNavigate();
  const { deckId } = useParams<{ deckId: string }>();
  const { deck, cards, isLoading, error } = useDeck(deckId ?? null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Shuffle cards if requested
  const displayCards = useMemo(() => {
    if (isShuffled && cards.length > 0) {
      return shuffleArray(cards);
    }
    return cards;
  }, [cards, isShuffled]);

  const currentCard = displayCards[currentIndex] ?? null;
  const progress = cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0;

  const handleNext = () => {
    if (currentIndex < displayCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsComplete(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsComplete(false);
  };

  const handleShuffle = () => {
    setIsShuffled(!isShuffled);
    setCurrentIndex(0);
    setIsComplete(false);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  if (error || !deck) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-destructive">{error ?? 'Deck non trouvé'}</p>
          <Button variant="outline" onClick={() => navigate('/student/learning')} className="mt-4">
            Retour aux decks
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (cards.length === 0) {
    return (
      <PageContainer>
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/student/learning')}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{deck.title}</h1>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Deck vide
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Ce deck ne contient pas encore de cartes
            </p>
            <Button variant="outline" onClick={() => navigate('/student/learning')}>
              Retour aux decks
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Session complete screen
  if (isComplete) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Session terminée !
            </h1>
            <p className="text-muted-foreground">
              Tu as revu les {cards.length} cartes de ce deck
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/student/learning')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour aux decks
            </Button>
            <Button onClick={handleRestart}>
              Recommencer
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

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

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">{deck.title}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            className={isShuffled ? 'bg-primary/10' : ''}
          >
            <Shuffle className="h-4 w-4 mr-1" />
            {isShuffled ? 'Ordre normal' : 'Mélanger'}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
      </div>

      {/* Card viewer */}
      <div className="py-6">
        {currentCard && (
          <CardViewer
            card={currentCard}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isLast={currentIndex === displayCards.length - 1}
            isFirst={currentIndex === 0}
          />
        )}
      </div>
    </PageContainer>
  );
}
