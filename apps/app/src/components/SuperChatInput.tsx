/**
 * SuperChatInput - Input chat moderne avec entrée vocale intelligente
 *
 * Features:
 * - Upload fichiers multi-support
 * - Entrée vocale adaptée au contexte pédagogique:
 *   - Mode 'text' (Web Speech API) pour matières générales
 *   - Mode 'audio' (MediaRecorder) pour langues vivantes
 * - Preview audio avant envoi (contrôle utilisateur)
 */

import React, { type FormEvent, type KeyboardEvent, type ReactElement, useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Mic, Square, Paperclip, X, FileText, FileImage, File as FileIcon, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { AudioPreview } from './AudioPreview';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useOptimizedFileUpload } from '@/hooks/useOptimizedFileUpload';
import type { IFileAttachment, VoiceMode } from '@/types';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// ========================================
// Helpers
// ========================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(file: File): React.ReactElement {
  const { type } = file;

  if (type.startsWith('image/')) {
    return <FileImage className="h-4 w-4 text-blue-500" />;
  } else if (type === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-500" />;
  } else if (type.includes('audio')) {
    return <Mic className="h-4 w-4 text-purple-500" />;
  }

  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

// Matières linguistiques nécessitant analyse audio (prononciation)
const LANGUAGE_SUBJECTS = ['anglais', 'espagnol', 'allemand', 'italien', 'chinois', 'russe', 'arabe', 'japonais'];

function detectVoiceMode(subject: string): VoiceMode {
  return LANGUAGE_SUBJECTS.includes(subject.toLowerCase()) ? 'audio' : 'text';
}

// ========================================
// Component
// ========================================

interface ISuperChatInputProps {
  readonly onSendMessage: (message: string, attachedFiles?: IFileAttachment[]) => Promise<void>;
  readonly isLoading: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly subject: string; // ✅ NOUVEAU - Détection automatique mode vocal
}

export function SuperChatInput({
  onSendMessage,
  isLoading,
  disabled = false,
  placeholder = "Écrivez votre question...",
  subject
}: ISuperChatInputProps): ReactElement {

  const [manualText, setManualText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Détection automatique mode vocal selon matière
  const voiceMode = detectVoiceMode(subject);

  // Callback stable pour transcription (évite boucle infinie)
  const handleTranscriptUpdate = useCallback((text: string) => {
    // Mode 'text': injecter transcription dans input
    if (voiceMode === 'text') {
      setManualText(prev => `${prev} ${text}`);
    }
  }, [voiceMode]);

  // Hook vocal unifié (text ou audio selon mode)
  const voice = useVoiceInput({
    mode: voiceMode,
    lang: 'fr-FR',
    onTranscriptUpdate: handleTranscriptUpdate
  });

  // File upload
  const {
    files,
    isProcessing,
    uploadFile,
    removeFile,
    clearFiles
  } = useOptimizedFileUpload({
    maxSize: 15 * 1024 * 1024,
    enablePreview: true
  });

  // ========================================
  // Audio Preview State (mode audio uniquement)
  // ========================================
  const [showAudioPreview, setShowAudioPreview] = useState(false);

  // Afficher preview quand blob audio disponible
  useEffect(() => {
    if (voiceMode === 'audio' && voice.audioBlob && !voice.isActive) {
      setShowAudioPreview(true);
    }
  }, [voiceMode, voice.audioBlob, voice.isActive]);

  // ========================================
  // Handlers Audio Preview
  // ========================================
  const handleAudioConfirm = async () => {
    if (!voice.audioBlob) return;

    try {
      // Créer File depuis Blob
      const audioFile = new File(
        [voice.audioBlob],
        `audio-${Date.now()}.webm`,
        { type: voice.audioBlob.type }
      );

      // Upload du fichier audio
      await uploadFile(audioFile, { context: 'voice-pronunciation-analysis' });

      // Envoyer direct (files array sera mis à jour automatiquement)
      await onSendMessage('', files.concat({ file: audioFile, type: 'document' }));

      // Nettoyer
      setShowAudioPreview(false);
      voice.clear();
      clearFiles();
      inputRef.current?.focus();

    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'audio', { error });
    }
  };

  const handleAudioReRecord = () => {
    setShowAudioPreview(false);
    voice.clear();
    void voice.start();
  };

  // ========================================
  // Submit Handler
  // ========================================
  const currentText = manualText;
  const canSend = (currentText.trim().length > 0 || files.length > 0) && !isLoading && !disabled && !isProcessing && !voice.isActive;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!canSend) return;

    const messageToSend = currentText.trim();

    // Reset
    setManualText('');

    try {
      await onSendMessage(messageToSend, files.length > 0 ? files : undefined);
      clearFiles();
      inputRef.current?.focus();
    } catch {
      // Restaurer texte en cas d'erreur
      setManualText(messageToSend);
    }
  };

  // ========================================
  // File Upload Handler
  // ========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file) {
          await uploadFile(file);
        }
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ========================================
  // Voice Toggle Handler
  // ========================================
  const handleVoiceToggle = (): void => {
    if (voice.isActive) {
      voice.stop();
    } else {
      // Effacer le texte précédent quand on démarre une nouvelle transcription (mode text)
      if (voiceMode === 'text') {
        setManualText('');
      }
      void voice.start();
    }
  };

  // ========================================
  // Keyboard Handler
  // ========================================
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        void handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
      }
    }
  };

  // ========================================
  // Render
  // ========================================
  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Indicateur enregistrement avec VAD (mode audio) ou transcription (mode text) */}
      <AnimatePresence>
        {voice.isActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3"
          >
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium">
                  {voiceMode === 'audio'
                    ? (voice.isSpeaking ? '🎤 Parole détectée...' : '⏸️ Silence (auto-envoi dans 1.5s)')
                    : '🎤 Transcription en cours...'
                  }
                </span>
              </div>
              {voiceMode === 'audio' && (
                <span className="text-sm font-mono text-muted-foreground">{voice.duration}s / 30s</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Audio (mode audio uniquement) */}
      <AnimatePresence>
        {showAudioPreview && voice.audioBlob && (
          <div className="mb-3">
            <AudioPreview
              blob={voice.audioBlob}
              duration={voice.duration}
              onConfirm={handleAudioConfirm}
              onReRecord={handleAudioReRecord}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Erreur vocale */}
      <AnimatePresence>
        {voice.error && !voice.isActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3"
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{voice.error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* État upload */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-2"
          >
            <Badge variant="secondary" className="text-xs">
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              📤 Upload en cours...
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File attachments preview */}
      {files.length > 0 && (
        <div className="mb-2 sm:mb-3 flex flex-col gap-1.5 sm:gap-2">
          <AnimatePresence>
            {files.map((file, index) => (
              <motion.div
                key={file.fileId ?? `file-${file.file.name}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex-shrink-0">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                      {getFileIcon(file.file)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {file.file.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {formatFileSize(file.file.size)}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="h-7 w-7 flex-shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form principal */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={currentText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              voice.isActive
                ? (voiceMode === 'audio' ? `🎤 Enregistrement... (${voice.duration}s/30s)` : '🎤 Transcription...')
                : placeholder
            }
            disabled={disabled || isLoading || voice.isActive}
            className="resize-none"
            autoFocus
          />
        </div>

        {/* File upload button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || isLoading || isProcessing || voice.isActive}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 h-10 w-10 sm:h-11 sm:w-11"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        {/* Voice button - Mode adapté au contexte */}
        {voice.isSupported && (
          <Button
            type="button"
            variant={voice.isActive ? "destructive" : "outline"}
            size="icon"
            disabled={disabled || isLoading || showAudioPreview}
            onClick={handleVoiceToggle}
            className={cn(
              "shrink-0 h-10 w-10 sm:h-11 sm:w-11 transition-all",
              voice.isActive && "ring-2 ring-red-500 ring-offset-2"
            )}
            title={
              voiceMode === 'audio'
                ? '🎤 Enregistrer pour analyse prononciation'
                : '🎤 Parler pour transcrire en texte'
            }
          >
            {voice.isActive ? (
              <Square className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        )}

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="shrink-0 h-10 w-10 sm:h-11 sm:w-11"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        accept="image/*,.pdf,.doc,.docx,.txt,audio/*"
        className="hidden"
      />
    </div>
  );
}

export default SuperChatInput;
