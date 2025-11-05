/**
 * AudioPreview - Composant de prévisualisation audio avant envoi
 *
 * Permet à l'utilisateur de:
 * - Réécouter son enregistrement
 * - Ré-enregistrer si insatisfait
 * - Confirmer l'envoi
 *
 * UX Pattern: ChatGPT-like audio confirmation
 */

import { type ReactElement, useMemo } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface AudioPreviewProps {
  readonly blob: Blob;
  readonly duration: number;
  readonly onConfirm: () => void;
  readonly onReRecord: () => void;
}

export function AudioPreview({
  blob,
  duration,
  onConfirm,
  onReRecord
}: AudioPreviewProps): ReactElement {
  // Créer URL objet pour lecteur audio
  const audioUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  // Formater durée mm:ss
  const formattedDuration = useMemo(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 sm:p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              🎤 Aperçu de votre enregistrement
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {formattedDuration}
            </span>
          </div>

          {/* Lecteur audio natif */}
          <audio
            src={audioUrl}
            controls
            className="w-full mb-3"
            controlsList="nodownload noplaybackrate"
          >
            Votre navigateur ne supporte pas la lecture audio.
          </audio>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={onReRecord}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Ré-enregistrer
            </Button>
            <Button
              onClick={onConfirm}
              size="sm"
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AudioPreview;
