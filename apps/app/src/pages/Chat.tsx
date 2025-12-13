/**
 * Chat - Page chat étudiant avec architecture Atomic Design
 *
 * Architecture propre:
 * - URL = single source of truth (sessionId + subject)
 * - Navigation gérée ici uniquement
 * - useChat = hook pur de logique métier
 */

import { useNavigate, useSearchParams } from 'react-router';
import { type FC, type ReactElement, useCallback, useEffect } from 'react';
import { Brain, Volume2, VolumeX } from 'lucide-react';
import smartToast from '@/utils/toastUtils';
import SuperChatInput from '@/components/SuperChatInput';
import { useChat } from '@/hooks/useChat';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ChatConversation } from '@/components/chat/organisms/ChatConversation';
import type { IFileAttachment } from '@/types';
import { useAudio } from '@/lib/audioHooks';

const Chat: FC = (): ReactElement => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subjects } = useStudentDashboard();
  const audio = useAudio();

  // URL = source de vérité pour sessionId et subject
  const sessionId = searchParams.get('sessionId');
  const subject = searchParams.get('subject') ?? 'mathematiques';

  // Hook de chat TanStack AI
  const {
    messages,
    isLoading,
    error,
    sendMessage
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
      // Extraire tous les fileIds des fichiers attachés
      const fileIds = attachedFiles
        ?.map(file => file.fileId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      await sendMessage(content, fileIds && fileIds.length > 0 ? fileIds : undefined);
    } catch {
      smartToast.error('Erreur lors de l\'envoi du message');
    }
  }, [subject, sendMessage]);

  const handleBackToDashboard = () => {
    void navigate('/student', { replace: true });
  };

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
            <Button
              variant="outline"
              size="icon"
              onClick={audio.toggleGlobal}
              title={audio.state.isGlobalEnabled ? "Désactiver l'audio" : "Activer l'audio"}
              className="h-9 w-9"
            >
              {audio.state.isGlobalEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
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
          subject={subject}
          onSendMessage={(message, attachedFile) => handleSendMessage(message, attachedFile)}
          isLoading={isLoading}
          placeholder="Posez votre question..."
        />
      </div>
    </div>
  );
};

export default Chat;
