/**
 * SuperChatInput - Input chat avec entrée vocale Web Speech API
 *
 * Architecture simplifiée:
 * - Fichiers uploadés directement au contexte de session (pas de preview)
 * - Entrée vocale via Web Speech API (transcription temps réel)
 */

import { type FormEvent, type KeyboardEvent, type ReactElement, type ChangeEvent, useState, useRef, useCallback } from 'react';
import { Send, Loader2, Mic, Square, Paperclip, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { usePresignedUpload } from '@/hooks/usePresignedUpload';
import type { IFileAttachment } from '@/types';
import { cn } from '@/lib/utils';

// ========================================
// Component
// ========================================

interface ISuperChatInputProps {
  /** Envoi d'un message texte */
  readonly onSendMessage: (message: string) => Promise<void>;
  /** Upload direct de fichier au contexte de session */
  readonly onFileAttachedToContext?: (file: IFileAttachment) => void;
  /** Fichiers en attente d'envoi avec le prochain message */
  readonly pendingAttachments?: Array<{ fileId: string; fileName: string }>;
  readonly isLoading: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export function SuperChatInput({
  onSendMessage,
  onFileAttachedToContext,
  pendingAttachments = [],
  isLoading,
  disabled = false,
  placeholder = "Écrivez votre question..."
}: ISuperChatInputProps): ReactElement {

  const [manualText, setManualText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Callback stable pour transcription
  const handleTranscriptUpdate = useCallback((text: string) => {
    setManualText(prev => `${prev} ${text}`.trim());
  }, []);

  // Hook vocal simplifié (Web Speech API uniquement)
  const voice = useVoiceInput({
    lang: 'fr-FR',
    onTranscriptUpdate: handleTranscriptUpdate
  });

  // File upload (Scaleway presigned URLs) - fichiers vont directement au contexte
  const { isProcessing, uploadFile, clearFiles } = usePresignedUpload();

  // ========================================
  // Submit Handler
  // ========================================
  const canSend = manualText.trim().length > 0 && !isLoading && !disabled && !isProcessing && !voice.isActive;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!canSend) return;

    const messageToSend = manualText.trim();
    setManualText('');

    try {
      await onSendMessage(messageToSend);
      inputRef.current?.focus();
    } catch {
      setManualText(messageToSend);
    }
  };

  // ========================================
  // File Upload Handler - Fichiers ajoutés au contexte pending
  // ========================================
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file) {
          const attachment = await uploadFile(file);
          if (attachment && onFileAttachedToContext) {
            onFileAttachedToContext(attachment);
          }
        }
      }
      clearFiles();
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
      setManualText('');
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
      {/* Indicateur transcription en cours */}
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
                  🎤 Transcription en cours...
                </span>
              </div>
            </div>
          </motion.div>
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

      {/* Fichiers en attente d'envoi */}
      <AnimatePresence>
        {pendingAttachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-2 flex flex-wrap gap-1.5"
          >
            {pendingAttachments.map((file) => (
              <Badge key={file.fileId} variant="outline" className="text-xs">
                📎 {file.fileName}
              </Badge>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form principal */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voice.isActive ? '🎤 Transcription...' : placeholder}
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

        {/* Voice button - Web Speech API */}
        {voice.isSupported && (
          <Button
            type="button"
            variant={voice.isActive ? "destructive" : "outline"}
            size="icon"
            disabled={disabled || isLoading}
            onClick={handleVoiceToggle}
            className={cn(
              "shrink-0 h-10 w-10 sm:h-11 sm:w-11 transition-all",
              voice.isActive && "ring-2 ring-red-500 ring-offset-2"
            )}
            title="🎤 Parler pour transcrire en texte"
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
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
    </div>
  );
}

export default SuperChatInput;
