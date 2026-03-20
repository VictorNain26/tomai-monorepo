/**
 * ChatInput Component - TomAI 2026
 *
 * Input pour envoyer des messages avec support attachments et voice input.
 * Sub-components: AttachmentMenu, AttachmentPreview (extracted for maintainability).
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Mic, Square, Send, Loader2, StopCircle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { useVoiceInput, useIconColors, useThemeColors } from '@/hooks';
import type { ChatFileAttachment } from '@/hooks';
import { bgColors } from '@/lib/styles';
import { AttachmentMenu } from './AttachmentMenu';
import { AttachmentPreview } from './AttachmentPreview';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onFileSelected?: (
    uri: string,
    fileName: string,
    mimeType: string
  ) => Promise<void>;
  onOpenClasseur?: () => void;
  onStop?: () => void;
  pendingAttachments: ChatFileAttachment[];
  onRemoveAttachment?: (fileId: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  isUploading?: boolean;
  placeholder?: string;
}

export const ChatInput = memo(function ChatInput({
  onSendMessage,
  onFileSelected,
  onOpenClasseur,
  onStop,
  pendingAttachments,
  onRemoveAttachment,
  isLoading = false,
  isStreaming = false,
  isUploading = false,
  placeholder = 'Pose ta question...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const toast = useToast();
  const voice = useVoiceInput();
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Recording pulse animation
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (voice.isRecording) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [voice.isRecording, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const canSend =
    !isLoading && !voice.isRecording && !voice.isProcessing &&
    (message.trim().length > 0 || pendingAttachments.length > 0);

  const handleVoiceToggle = useCallback(async () => {
    if (voice.isRecording) {
      const transcription = await voice.stopRecording();
      if (transcription) {
        setMessage((prev) => prev ? `${prev} ${transcription}` : transcription);
      }
    } else if (!voice.isProcessing) {
      const started = await voice.startRecording();
      if (!started && voice.error) {
        toast.error('Erreur microphone', voice.error);
        voice.clearError();
      }
    }
  }, [voice, toast]);

  const handleVoiceCancel = useCallback(async () => {
    if (voice.isRecording) {
      await voice.cancelRecording();
    }
  }, [voice]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const content = message.trim();
    setMessage('');
    onSendMessage(content);
  }, [canSend, message, onSendMessage]);

  const handleToggleMenu = useCallback(() => {
    setShowAttachmentMenu((prev) => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setShowAttachmentMenu(false);
  }, []);

  return (
    <View className="border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-4 pb-4 pt-2">
      <AttachmentPreview
        attachments={pendingAttachments}
        onRemove={onRemoveAttachment}
      />

      {/* Input Row */}
      <View className="flex-row items-center gap-2">
        {/* Attachment Button */}
        {onFileSelected && (
          <AttachmentMenu
            visible={showAttachmentMenu}
            onToggle={handleToggleMenu}
            onClose={handleCloseMenu}
            onFileSelected={onFileSelected}
            onOpenClasseur={onOpenClasseur}
            isDisabled={isLoading || isUploading}
            isUploading={isUploading}
          />
        )}

        {/* Text Input / Recording State */}
        <View className="flex-1 flex-row items-center rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3">
          {voice.isRecording ? (
            <View className="flex-1 flex-row items-center gap-2 py-3">
              <Animated.View
                style={[
                  {
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.destructive,
                  },
                  pulseStyle,
                ]}
              />
              <Text className="text-base font-semibold text-red-600 dark:text-red-400">
                {voice.duration}s
              </Text>
              <Text className="flex-1 text-sm text-stone-600 dark:text-stone-400">
                Appui long pour annuler
              </Text>
            </View>
          ) : voice.isProcessing ? (
            <View className="flex-1 flex-row items-center gap-2 py-3">
              <Loader2 color={iconColors.muted} size={16} />
              <Text className="text-base text-stone-600 dark:text-stone-400">
                Transcription...
              </Text>
            </View>
          ) : (
            <TextInput
              testID="chat-input"
              value={message}
              onChangeText={setMessage}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              editable={!isLoading}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              className="max-h-24 flex-1 py-3 text-base text-stone-800 dark:text-stone-100"
            />
          )}
        </View>

        {/* Voice Button */}
        <TouchableOpacity
          onPress={handleVoiceToggle}
          onLongPress={handleVoiceCancel}
          disabled={isLoading || voice.isProcessing}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: voice.isRecording
              ? colors.destructive
              : bgColors.muted[50],
            opacity: isLoading || voice.isProcessing ? 0.5 : 1,
          }}
          accessibilityLabel={
            voice.isRecording
              ? "Arreter l'enregistrement"
              : 'Enregistrer un message vocal'
          }
          accessibilityHint="Appui long pour annuler"
        >
          {voice.isRecording ? (
            <Square color={colors.primaryForeground} size={16} fill={colors.primaryForeground} />
          ) : voice.isProcessing ? (
            <Mic color={iconColors.muted} size={18} />
          ) : (
            <Mic color={iconColors.foreground} size={18} />
          )}
        </TouchableOpacity>

        {/* Send / Stop Button */}
        {isStreaming && onStop ? (
          <TouchableOpacity
            onPress={onStop}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.destructive }}
            accessibilityLabel="Arrêter la génération"
          >
            <StopCircle color={colors.primaryForeground} size={18} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID="chat-send-button"
            onPress={handleSend}
            disabled={!canSend}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: canSend
                ? colors.primary
                : bgColors.muted[50],
            }}
            accessibilityLabel="Envoyer le message"
          >
            <Send
              color={canSend ? colors.primaryForeground : iconColors.muted}
              size={18}
              style={!canSend ? { opacity: 0.5 } : undefined}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
