/**
 * LearningDecks - Liste des decks de révision
 * Simple liste sans gamification
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { Layers, Plus, ArrowLeft } from 'lucide-react';
import { useDecks, useDeckMutations } from '@/hooks/useLearning';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
import { DeckCard } from '@/components/learning/DeckCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function LearningDecks(): ReactElement {
  const navigate = useNavigate();
  const { decks, isLoading, error } = useDecks();
  const { deleteDeck, isDeleting } = useDeckMutations();
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);

  const handlePlay = (deckId: string) => {
    void navigate(`/student/learning/${deckId}`);
  };

  const handleDelete = async () => {
    if (deckToDelete) {
      await deleteDeck(deckToDelete);
      setDeckToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="page" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-destructive">Erreur: {error}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
            Réessayer
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/student')}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Mes révisions
            </h1>
            <p className="text-muted-foreground mt-2">
              Flashcards, QCM et Vrai/Faux pour réviser
            </p>
          </div>
          <Button onClick={() => navigate('/student/learning/new')}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau deck
          </Button>
        </div>
      </div>

      {/* Decks List */}
      {decks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucun deck de révision
            </h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Crée ton premier deck pour réviser avec des flashcards, QCM ou questions Vrai/Faux
            </p>
            <Button onClick={() => navigate('/student/learning/new')}>
              <Plus className="h-4 w-4 mr-1" />
              Créer un deck
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onPlay={handlePlay}
              onDelete={setDeckToDelete}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deckToDelete} onOpenChange={() => setDeckToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce deck ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les cartes de ce deck seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
