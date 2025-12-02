/**
 * DeckCard - Carte affichant un deck dans la liste
 */

import { type ReactElement } from 'react';
import { Layers, BookOpen, Trash2, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ILearningDeck } from '@/types';

interface DeckCardProps {
  deck: ILearningDeck;
  onPlay: (deckId: string) => void;
  onDelete: (deckId: string) => void;
}

// Format subject name
function formatSubjectName(subject: string): string {
  return subject
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format relative date
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Aujourd'hui";
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  } else {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
}

// Source badge color
function getSourceBadge(source: ILearningDeck['source']): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (source) {
    case 'prompt':
      return { label: 'Manuel', variant: 'secondary' };
    case 'conversation':
      return { label: 'Conversation', variant: 'default' };
    case 'document':
      return { label: 'Document', variant: 'outline' };
    case 'rag_program':
      return { label: 'Programme', variant: 'default' };
    default:
      return { label: source, variant: 'secondary' };
  }
}

export function DeckCard({ deck, onPlay, onDelete }: DeckCardProps): ReactElement {
  const sourceBadge = getSourceBadge(deck.source);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Deck Info */}
          <div className="flex-1 min-w-0" onClick={() => onPlay(deck.id)}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {deck.title}
              </h3>
              <Badge variant={sourceBadge.variant} className="shrink-0 text-xs">
                {sourceBadge.label}
              </Badge>
            </div>

            {deck.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {deck.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {formatSubjectName(deck.subject)}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {deck.cardCount} carte{deck.cardCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs">
                {formatRelativeDate(deck.updatedAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="default"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(deck.id);
              }}
              disabled={deck.cardCount === 0}
            >
              <Play className="h-4 w-4 mr-1" />
              Réviser
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(deck.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
