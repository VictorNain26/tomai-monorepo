/**
 * ChatInput Component - TomAI 2026
 *
 * Input pour envoyer des messages avec support attachments et voice input.
 * Intègre la dictée vocale avec transcription automatique.
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Mic, Square, Send, ImageIcon, Paperclip } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useVoiceInput, useIconColors } from '@/hooks';
import type { ChatFileAttachment } from '@/hooks';
import { bgColors, colors, opacity } from '@/lib/styles';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onFileSelected?: (
    uri: string,
    fileName: string,
    mimeType: string
  ) => Promise<void>;
  pendingAttachments: ChatFileAttachment[];
  onRemoveAttachment?: (fileId: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onFileSelected,
  pendingAttachments,
  onRemoveAttachment,
  isLoading = false,
  placeholder = 'Pose ta question...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);
  const iconColors = useIconColors();

  // Voice input hook
  const voice = useVoiceInput();

  const canSend =
    !isLoading && !voice.isRecording && !voice.isProcessing &&
    (message.trim().length > 0 || pendingAttachments.length > 0);

  // Handle voice recording toggle
  const handleVoiceToggle = useCallback(async () => {
    if (voice.isRecording) {
      // Stop and get transcription
      const transcription = await voice.stopRecording();
      if (transcription) {
        // Append transcription to message
        setMessage((prev) =>
          prev ? `${prev} ${transcription}` : transcription
        );
      }
    } else if (!voice.isProcessing) {
      // Start recording
      const started = await voice.startRecording();
      if (!started && voice.error) {
        Alert.alert('Erreur microphone', voice.error);
        voice.clearError();
      }
    }
  }, [voice]);

  // Cancel recording on long press
  const handleVoiceCancel = useCallback(async () => {
    if (voice.isRecording) {
      await voice.cancelRecording();
    }
  }, [voice]);

  async function handleSend() {
    if (!canSend) return;

    const content = message.trim();
    setMessage('');
    await onSendMessage(content);
  }

  async function handlePickDocument() {
    if (!onFileSelected) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      await onFileSelected(
        file.uri,
        file.name,
        file.mimeType ?? 'application/octet-stream'
      );
    } catch {
      // User cancelled or error
    }
  }

  async function handlePickImage() {
    if (!onFileSelected) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileName =
        asset.fileName ?? `image_${Date.now()}.${asset.type ?? 'jpg'}`;
      await onFileSelected(asset.uri, fileName, asset.mimeType ?? 'image/jpeg');
    } catch {
      // User cancelled or error
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="border-t border-border bg-background px-4 pb-4 pt-2">
        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-2"
          >
            <View className="flex-row gap-2">
              {pendingAttachments.map((attachment) => (
                <View
                  key={attachment.fileId}
                  className="relative rounded-xl bg-muted p-2"
                >
                  {attachment.preview ? (
                    <Image
                      source={{ uri: attachment.preview }}
                      className="h-16 w-16 rounded-lg"
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className="h-16 w-16 items-center justify-center rounded-lg"
                      style={{ backgroundColor: bgColors.primary[10] }}
                    >
                      <Text className="text-2xl">📄</Text>
                    </View>
                  )}
                  <Text
                    variant="tiny"
                    className="mt-1 max-w-[64px] text-muted-foreground"
                    numberOfLines={1}
                  >
                    {attachment.fileName}
                  </Text>
                  {onRemoveAttachment && (
                    <TouchableOpacity
                      onPress={() => onRemoveAttachment(attachment.fileId)}
                      className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-destructive"
                    >
                      <Text className="text-xs text-white">✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Input Row */}
        <View className="flex-row items-end gap-2">
          {/* Attachment Buttons */}
          {onFileSelected && (
            <View className="flex-row gap-1 pb-1">
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isLoading}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={[
                  { backgroundColor: bgColors.muted[50] },
                  isLoading ? { opacity: opacity.disabled } : undefined,
                ]}
              >
                <ImageIcon color={iconColors.muted} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickDocument}
                disabled={isLoading}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={[
                  { backgroundColor: bgColors.muted[50] },
                  isLoading ? { opacity: opacity.disabled } : undefined,
                ]}
              >
                <Paperclip color={iconColors.muted} size={18} />
              </TouchableOpacity>
            </View>
          )}

          {/* Text Input */}
          <View className="flex-1 flex-row items-end rounded-2xl border border-input bg-background px-3">
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder={
                voice.isRecording
                  ? `Enregistrement... ${voice.duration}s`
                  : voice.isProcessing
                    ? 'Transcription en cours...'
                    : placeholder
              }
              placeholderTextColor={colors.muted.foreground}
              multiline
              maxLength={2000}
              editable={!isLoading && !voice.isRecording && !voice.isProcessing}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              className="max-h-24 flex-1 py-3 text-base text-foreground"
            />
          </View>

          {/* Voice Button */}
          <TouchableOpacity
            onPress={handleVoiceToggle}
            onLongPress={handleVoiceCancel}
            disabled={isLoading || voice.isProcessing}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: voice.isRecording
                ? colors.destructive.DEFAULT
                : bgColors.muted[50],
              opacity: isLoading || voice.isProcessing ? opacity.disabled : 1,
            }}
          >
            {voice.isRecording ? (
              <Square color={colors.primary.foreground} size={16} fill={colors.primary.foreground} />
            ) : voice.isProcessing ? (
              <Mic color={iconColors.muted} size={18} />
            ) : (
              <Mic color={iconColors.foreground} size={18} />
            )}
          </TouchableOpacity>

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: canSend
                ? colors.primary.DEFAULT
                : bgColors.muted[50],
            }}
          >
            <Send
              color={canSend ? colors.primary.foreground : iconColors.muted}
              size={18}
              style={!canSend ? { opacity: opacity.disabled } : undefined}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
