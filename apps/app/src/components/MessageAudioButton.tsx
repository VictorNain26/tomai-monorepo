import { Button } from './ui/button';
import { Volume2, Square } from 'lucide-react';
import { useSimpleAudio } from '@/lib/audioHooks';

interface MessageAudioButtonProps {
  content: string;
  messageId: string;
}

export function MessageAudioButton({
  content,
  messageId
}: MessageAudioButtonProps) {
  const { speak, stop, isSpeaking, isSupported } = useSimpleAudio();

  if (!isSupported) return null;

  const handleToggleSpeak = async () => {
    try {
      if (isSpeaking) {
        stop();
      } else {
        await speak(messageId, content);
      }
    } catch {
      // Erreur gérée par AudioManager
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleSpeak}
      className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-md hover:bg-muted hover:border-primary/30 hover:shadow-lg transition-all duration-200 touch-manipulation"
      aria-label={isSpeaking ? "Arrêter la lecture" : "Lire le message"}
    >
      {isSpeaking ? (
        <Square className="h-3 w-3 md:h-3.5 md:w-3.5" />
      ) : (
        <Volume2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
      )}
    </Button>
  );
}
