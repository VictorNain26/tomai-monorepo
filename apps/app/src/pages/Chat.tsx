/**
 * Chat - Page chat étudiant avec architecture Atomic Design
 *
 * Architecture propre:
 * - URL = single source of truth (sessionId + subject)
 * - Navigation gérée ici uniquement
 * - useChat = hook pur de logique métier
 */

import { useNavigate, useSearchParams } from 'react-router';
import { type FC, type ReactElement, useCallback, useEffect, useState } from 'react';
import { Brain, Volume2, VolumeX, FileText, Download, RotateCcw } from 'lucide-react';
import smartToast from '@/utils/toastUtils';
import SuperChatInput from '@/components/SuperChatInput';
import { useChat } from '@/hooks/useChat';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ChatConversation } from '@/components/chat/organisms/ChatConversation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { IFileAttachment, IChatFileAttachment } from '@/types';
import { useAudio } from '@/lib/audioHooks';
import { getBackendURL } from '@/utils/urls';

const Chat: FC = (): ReactElement => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subjects } = useStudentDashboard();
  const audio = useAudio();
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [deleteFilesOnReset, setDeleteFilesOnReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // URL = source de vérité pour sessionId et subject
  const sessionId = searchParams.get('sessionId');
  const subject = searchParams.get('subject') ?? 'mathematiques';

  // Hook de chat TanStack AI
  const {
    messages,
    sessionFiles,
    isLoading,
    error,
    sendMessage,
    clear: clearChat,
  } = useChat({
    sessionId,
    subject,
    onSessionCreated: (newSessionId) => {
      // Backend a créé une nouvelle session, mettre à jour l'URL
      const params = new URLSearchParams();
      params.set('subject', subject);
      params.set('sessionId', newSessionId);
      void navigate(`/student/chat?${params.toString()}`, { replace: true });
    }
  });

  const { stopSpeaking } = audio;

  // Arrêter l'audio lors du démontage
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const handleSendMessage = useCallback(async (content: string, attachedFiles?: IFileAttachment[]) => {
    if (!subject) {
      smartToast.error('Aucune matière sélectionnée');
      return;
    }

    try {
      // Convertir IFileAttachment en IChatFileAttachment pour affichage
      const attachments: IChatFileAttachment[] | undefined = attachedFiles
        ?.filter((file): file is IFileAttachment & { fileId: string } => typeof file.fileId === 'string')
        .map(file => ({
          fileId: file.fileId,
          fileName: file.file.name,
          mimeType: file.file.type,
          size: file.file.size,
          preview: file.preview,
        }));

      await sendMessage(content, attachments && attachments.length > 0 ? attachments : undefined);
    } catch {
      smartToast.error('Erreur lors de l\'envoi du message');
    }
  }, [subject, sendMessage]);

  const handleBackToDashboard = () => {
    void navigate('/student', { replace: true });
  };

  // Reset session (clear messages, optionally delete files)
  const handleReset = useCallback(async () => {
    if (!sessionId) return;

    setIsResetting(true);
    try {
      const response = await fetch(`${getBackendURL()}/api/chat/session/${sessionId}/reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteFiles: deleteFilesOnReset }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du reset');
      }

      // Clear local state
      clearChat();
      setIsResetDialogOpen(false);
      setDeleteFilesOnReset(false);
      smartToast.success('Conversation réinitialisée');
    } catch {
      smartToast.error('Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  }, [sessionId, deleteFilesOnReset, clearChat]);

  // Download fichier via presigned URL (Scaleway)
  const handleDownload = useCallback(async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`${getBackendURL()}/api/upload/file/${fileId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      const data = await response.json() as { success: boolean; downloadUrl?: string };
      if (data.success && data.downloadUrl) {
        // Ouvrir l'URL de téléchargement
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('URL de téléchargement non disponible');
      }
    } catch {
      smartToast.error('Erreur lors du téléchargement du fichier');
    }
  }, []);

  const currentSubjectData = subjects.find(s => s.key === subject);

  if (!subject) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>Aucune matière sélectionnée</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header fixe en haut - ne rétrécit jamais */}
      <div className="flex-shrink-0">
        <PageHeader
          title={currentSubjectData?.name ?? "Tom"}
          subtitle={currentSubjectData?.description ?? "Assistant pédagogique"}
          icon={currentSubjectData?.emoji ? <span className="text-2xl">{currentSubjectData.emoji}</span> : <Brain className="h-6 w-6" />}
          onBack={handleBackToDashboard}
          actions={
            <div className="flex items-center gap-2">
              {/* Bouton Documents - visible si fichiers présents */}
              {sessionFiles.length > 0 && (
                <Sheet open={isDocsOpen} onOpenChange={setIsDocsOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      title="Voir les documents"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Documents</span>
                      <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {sessionFiles.length}
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Documents de la session</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-3">
                      {sessionFiles.map((file) => (
                        <div
                          key={file.fileId}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{file.fileName}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => handleDownload(file.fileId, file.fileName)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              {/* Bouton Audio */}
              <Button
                variant="outline"
                size="icon"
                onClick={audio.toggleGlobal}
                title={audio.state.isGlobalEnabled ? "Désactiver l'audio" : "Activer l'audio"}
                className="h-9 w-9"
              >
                {audio.state.isGlobalEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>

              {/* Bouton Reset - visible si session existe */}
              {sessionId && (
                <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      title="Réinitialiser la conversation"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Réinitialiser la conversation ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action supprimera tous les messages de cette conversation.
                        Tu pourras recommencer une nouvelle discussion sur ce sujet.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex items-center space-x-2 py-4">
                      <Checkbox
                        id="deleteFiles"
                        checked={deleteFilesOnReset}
                        onCheckedChange={(checked) => setDeleteFilesOnReset(checked === true)}
                      />
                      <Label htmlFor="deleteFiles" className="text-sm text-muted-foreground">
                        Supprimer aussi les documents envoyés
                      </Label>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isResetting}>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReset}
                        disabled={isResetting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isResetting ? 'Réinitialisation...' : 'Réinitialiser'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          }
        />
      </div>

      {/* Zone scrollable au milieu - prend tout l'espace restant */}
      <div className="flex-1 min-h-0">
        <ChatConversation
          messages={messages}
          isLoading={isLoading}
          error={error}
          isAudioEnabled={audio.state.isGlobalEnabled}
          emptyStateMessage="Posez votre première question pour commencer !"
        />
      </div>

      {/* Input fixe en bas - ne rétrécit jamais */}
      <div className="flex-shrink-0 border-t border-border">
        <SuperChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          placeholder="Posez votre question..."
        />
      </div>
    </div>
  );
};

export default Chat;
