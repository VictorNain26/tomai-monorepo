/**
 * SessionHistory - Historique des sessions de chat
 * MVP: Liste des sessions avec reprise et suppression
 */

import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { MessageSquare, Clock, Trash2, Play, CalendarDays, ArrowLeft } from 'lucide-react';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { PageContainer } from '@/components/shared/PageContainer';
import { LoadingState } from '@/components/shared/LoadingState';
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

// Format date relative (aujourd'hui, hier, ou date)
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

// Format subject name nicely
function formatSubjectName(subject: string): string {
  return subject
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SessionHistory(): ReactElement {
  const navigate = useNavigate();
  const { sessions, isLoading, error, resumeSession, deleteSession, isDeleting } = useSessionHistory();
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete);
      setSessionToDelete(null);
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
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Mes conversations
        </h1>
        <p className="text-muted-foreground mt-2">
          Retrouvez et reprenez vos sessions d'apprentissage
        </p>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucune conversation
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Commencez une nouvelle session pour voir votre historique ici
            </p>
            <Button onClick={() => navigate('/student')}>
              Nouvelle conversation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => resumeSession(session.id, session.subject)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {formatSubjectName(session.subject)}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatRelativeDate(session.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {session.messagesCount} message{session.messagesCount > 1 ? 's' : ''}
                      </span>
                      {session.endedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Terminée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeSession(session.id, session.subject);
                      }}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Reprendre
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les messages de cette session seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
